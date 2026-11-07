import asyncio
import io
import json
import os
import re
import sys
import edge_tts

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

VOICE = "en-US-JennyNeural"
CONCURRENCY = 6

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNITS_JSON_PATH = os.path.join(BASE_DIR, "src", "data", "units.json")
PUBLIC_AUDIO_DIR = os.path.join(BASE_DIR, "public", "audio", "units")
REGISTRY_PATH = os.path.join(BASE_DIR, "src", "data", "audioRegistry.json")


def normalize_text(text: str) -> str:
    """Normalize text for audio lookup: lowercase, straight quotes, trim punctuation."""
    t = text.lower().strip()
    t = t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    # replace multiple whitespaces
    t = re.sub(r"\s+", " ", t)
    # remove edge punctuation like trailing periods, question marks, commas
    t = t.strip(" .,!?:;")
    return t


async def synthesize_item(sem, item, progress_tracker):
    async with sem:
        text = item["text"]
        rate = item["rate"]
        out_path = item["path"]
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            progress_tracker["done"] += 1
            if progress_tracker["done"] % 25 == 0 or progress_tracker["done"] == progress_tracker["total"]:
                print(f"[{progress_tracker['done']}/{progress_tracker['total']}] Cached: {os.path.basename(out_path)}")
            return True

        for attempt in range(1, 4):
            try:
                tts = edge_tts.Communicate(text, VOICE, rate=rate)
                await tts.save(out_path)
                if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
                    progress_tracker["done"] += 1
                    if progress_tracker["done"] % 25 == 0 or progress_tracker["done"] == progress_tracker["total"]:
                        print(f"[{progress_tracker['done']}/{progress_tracker['total']}] Generated: {os.path.basename(out_path)}")
                    return True
            except Exception as e:
                if attempt == 3:
                    print(f"FAILED after 3 attempts: {text} -> {e}")
                    return False
                await asyncio.sleep(1.0 * attempt)
        return False


async def main():
    print(f"Loading units from {UNITS_JSON_PATH}...")
    with open(UNITS_JSON_PATH, "r", encoding="utf-8") as f:
        units = json.load(f)

    tasks_to_generate = []
    audio_registry = {}

    for u in units:
        slug = u["slug"]
        unit_audio_dir = os.path.join(PUBLIC_AUDIO_DIR, slug)

        for v in u.get("vocabulary", []):
            no = v["no"]
            word_text = v["word"].strip()
            word_filename = f"vocab_{no:02d}_word.mp3"
            word_path = os.path.join(unit_audio_dir, word_filename)
            word_url = f"/audio/units/{slug}/{word_filename}"

            tasks_to_generate.append({
                "text": word_text,
                "rate": "-4%",
                "path": word_path,
                "url": word_url,
                "type": "word"
            })
            v["audioWord"] = word_url
            norm_word = normalize_text(word_text)
            if norm_word not in audio_registry:
                audio_registry[norm_word] = word_url

            if v.get("exampleEn"):
                ex_text = v["exampleEn"].strip()
                ex_filename = f"vocab_{no:02d}_example.mp3"
                ex_path = os.path.join(unit_audio_dir, ex_filename)
                ex_url = f"/audio/units/{slug}/{ex_filename}"

                tasks_to_generate.append({
                    "text": ex_text,
                    "rate": "-3%",
                    "path": ex_path,
                    "url": ex_url,
                    "type": "example"
                })
                v["audioExample"] = ex_url
                norm_ex = normalize_text(ex_text)
                if norm_ex not in audio_registry:
                    audio_registry[norm_ex] = ex_url

        for d in u.get("dialogueTurns", []):
            no = d["no"]
            line_text = d["lineEn"].strip()
            dia_filename = f"dialogue_{no:02d}.mp3"
            dia_path = os.path.join(unit_audio_dir, dia_filename)
            dia_url = f"/audio/units/{slug}/{dia_filename}"

            tasks_to_generate.append({
                "text": line_text,
                "rate": "-2%",
                "path": dia_path,
                "url": dia_url,
                "type": "dialogue"
            })
            d["audio"] = dia_url
            norm_dia = normalize_text(line_text)
            if norm_dia not in audio_registry:
                audio_registry[norm_dia] = dia_url

    total = len(tasks_to_generate)
    print(f"Total audio files to process: {total}")
    print(f"Using voice: {VOICE} with concurrency: {CONCURRENCY}")

    sem = asyncio.Semaphore(CONCURRENCY)
    tracker = {"done": 0, "total": total}

    batch_tasks = [synthesize_item(sem, item, tracker) for item in tasks_to_generate]
    results = await asyncio.gather(*batch_tasks)

    success_count = sum(1 for r in results if r)
    print(f"\nFinished synthesis: {success_count}/{total} files generated successfully.")

    print(f"Saving updated units.json with audio URLs...")
    with open(UNITS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(units, f, ensure_ascii=False, indent=2)

    print(f"Saving audio registry to {REGISTRY_PATH} ({len(audio_registry)} mapped phrases)...")
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(audio_registry, f, ensure_ascii=False, indent=2)

    print("ALL DONE SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(main())
