"""
Builds src/data/units.json from the 25 unit folders next to this app
(../UNIT 1 Introducing Yourself, ../UNIT 2 Daily Activities vocabs, ... ../UNIT 25 At the Party).

Sources per unit:
  - "<...> FULL.html"  -> vocabulary (word, IPA, meaning), dialogue lines (EN/VI with <b> key words)
                          and reflexive sentences (used as each word's example sentence)
  - "Unit N <title>.docx" -> English/Vietnamese titles, part of speech (vocab table) and the
                          dialogue speaker names.
  - Unit 9 (Grammar: Yes/No & Wh- Questions) is constructed from the Unit 9 grammar docx.

Run:  npm run parse:units   (needs `pip install python-docx`)
"""

import glob
import json
import os
import re
import sys

import docx

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(ROOT)
CONTENT = os.path.dirname(APP)
OUT = os.path.join(APP, "src", "data", "units.json")

# British IPA from Oxford Learner's Dictionaries.
with open(os.path.join(ROOT, "oxford_ipa_map.json"), encoding="utf-8") as _fh:
    OXFORD_IPA = json.load(_fh)
# One emoji per word/phrase for the vocabulary game cards.
with open(os.path.join(ROOT, "word_icons.json"), encoding="utf-8") as _fh:
    WORD_ICONS = json.load(_fh)

SPEAKER_RENAMES = {}


def extract_js_array(html, name):
    """Returns the JS array literal assigned to `const <name> = [...]` as Python data."""
    m = re.search(r"const\s+" + name + r"\s*=\s*\[", html)
    if not m:
        raise ValueError(f"missing const {name}")
    i = m.end() - 1
    depth, j, in_str = 0, i, None
    while True:
        c = html[j]
        if in_str:
            if c == "\\":
                j += 1
            elif c == in_str:
                in_str = None
        elif c in "\"'`":
            in_str = c
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        j += 1
    literal = html[i : j + 1]
    literal = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', literal)
    literal = re.sub(r",\s*([}\]])", r"\1", literal)
    return json.loads(literal)


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s).replace(" ", " ").strip()


def bold_words(s):
    return [strip_tags(b) for b in re.findall(r"<b>(.*?)</b>", s)]


def tokens(s):
    return set(re.findall(r"[a-z0-9]+", strip_tags(s).lower().replace("’", "'")))


def vocab_key(word):
    """'Slang: Cool' / 'chill (slang)' / 'Idiom: Spill the beans' -> 'cool' / 'chill' / 'spill the beans'."""
    w = strip_tags(word)
    w = re.sub(r"^(slang|idiom|phrasal verb|phrase)\s*:\s*", "", w, flags=re.I)
    w = re.sub(r"\s*\(.*?\)\s*", " ", w)
    return w.strip().lower().replace("’", "'")


def normalize_pos(pos):
    p = pos.strip().lower()
    if not p:
        return ""
    # Map common Vietnamese parts of speech to English if needed
    vn_map = {
        "danh từ": "noun",
        "động từ": "verb",
        "tính từ": "adjective",
        "trạng từ": "adverb",
        "đại từ": "pronoun",
        "đại từ nghi vấn": "pronoun",
        "cụm động từ": "phrasal verb",
        "cụm từ": "phrase",
        "thành ngữ": "idiom",
        "giới từ": "preposition",
        "liên từ": "conjunction",
    }
    return vn_map.get(p, p)


def clean_ipa(ipa):
    """Stored WITHOUT enclosing slashes."""
    return ipa.strip().strip("/").strip()


def cap_first(s):
    s = s.strip()
    return s[:1].upper() + s[1:] if s else s


def find_col(header, keywords):
    for i, h in enumerate(header):
        if any(k in h.lower() for k in keywords):
            return i
    return None


def parse_docx(path):
    d = docx.Document(path)
    paras = [line.strip() for p in d.paragraphs for line in p.text.splitlines() if line.strip()]
    title_en = re.sub(r"^(?:Unit\s*\d+\s*:\s*|ĐƠN VỊ\s*\d+\s*:\s*)", "", paras[0], flags=re.I).strip()
    title_vi = re.sub(r"^(?:Đơn vị\s*\d+\s*:\s*|Unit\s*\d+\s*:\s*|ĐƠN VỊ\s*\d+\s*:\s*|Bài học tiếng Anh:\s*)", "", paras[1] if len(paras) > 1 else paras[0], flags=re.I).strip()

    table_rows = {}
    for t in d.tables:
        header = [c.text.strip().lower() for c in t.rows[0].cells]
        ipa_idx = find_col(header, ["ipa", "pronunciation", "phiên âm"])
        pos_idx = find_col(header, ["part of speech", "word type", "loại từ", "pos"])
        mean_idx = find_col(header, ["meaning", "nghĩa", "vietnamese"])

        if ipa_idx is not None and len(header) >= 3:
            for r in t.rows[1:]:
                cells = [c.text.strip() for c in r.cells]
                word = vocab_key(cells[0])
                ipa = cells[ipa_idx] if ipa_idx < len(cells) else ""
                meaning = cells[mean_idx] if (mean_idx is not None and mean_idx < len(cells)) else cells[2]
                pos = cells[pos_idx] if (pos_idx is not None and pos_idx < len(cells)) else ""
                table_rows[word] = {"word": word, "ipa": ipa, "meaningVi": meaning, "pos": pos}

    speaker_lines = []
    in_dialogue = False
    for p in paras:
        if any(p.upper().startswith(x) for x in ["PHẦN 3", "PHẦN 4", "PHÂN 3", "PHÂN 4", "PART 3", "PART 4"]):
            if any(p.upper().startswith(x) for x in ["PHẦN 3", "PHÂN 3", "PART 3"]):
                in_dialogue = True
                continue
            if any(p.upper().startswith(x) for x in ["PHẦN 4", "PHÂN 4", "PART 4"]):
                break
        if not in_dialogue or p.startswith("("):
            continue
        m = re.match(r"^([A-Z][A-Za-z0-9_.]*(?: [A-Z][A-Za-z0-9_.]*)?)\s*:\s*(.+)$", p)
        if m:
            speaker_lines.append((m.group(1), m.group(2)))
    return title_en, title_vi, table_rows, speaker_lines


def best_speaker(line_en, speaker_lines, used):
    target = tokens(line_en)
    best, best_score = None, 0.0
    for idx, (speaker, text) in enumerate(speaker_lines):
        if idx in used:
            continue
        cand = tokens(text)
        if not cand:
            continue
        score = len(target & cand) / max(len(target | cand), 1)
        if score > best_score:
            best, best_score = idx, score
    return best, best_score


def token_list(s):
    return re.findall(r"[a-z0-9]+", strip_tags(s).lower().replace("’", "'"))


def contains_phrase(sentence, phrase):
    phrase = re.sub(r"\b(?:one's|your|you|someone)\b", " WILDCARD ", phrase.replace("’", "'"))
    words, sent = token_list(phrase), token_list(sentence)
    if not words:
        return False
    for i in range(len(sent) - len(words) + 1):
        if all(
            w == "wildcard"
            or sent[i + k] == w
            or (len(w) >= 3 and sent[i + k].startswith(w) and len(sent[i + k]) - len(w) <= 3)
            for k, w in enumerate(words)
        ):
            return True
    return False


def find_example(word, pools):
    w = word.lower()
    for pool in pools:
        for en, vi in pool:
            if any(vocab_key(b) == w for b in bold_words(en)):
                return en, vi
    for pool in pools:
        for en, vi in pool:
            if contains_phrase(en, w):
                return en, vi
    return None


def build_unit_9(folder):
    """Constructs Unit 9 (Yes/No & Wh- Questions) from its grammar docx."""
    doc_path = os.path.join(folder, "UNIT 2 YES-NO AND WH-H QUESTIONS.docx")
    d = docx.Document(doc_path)
    table = d.tables[0]
    words_raw = []
    for r in table.rows[1:]:
        cells = [c.text.strip() for c in r.cells]
        words_raw.append({
            "word": cells[0],
            "ipa": cells[1].strip("/"),
            "meaningVi": cells[2],
            "pos": normalize_pos(cells[3]),
        })

    # Paired reflexive sentences from Part 3
    paras = [line.strip() for p in d.paragraphs for line in p.text.splitlines() if line.strip()]
    part3_idx = next((i for i, p in enumerate(paras) if "PHẦN 3" in p.upper()), -1)
    part4_idx = next((i for i, p in enumerate(paras) if "PHẦN 4" in p.upper()), len(paras))
    
    pairs = []
    if part3_idx != -1:
        lines = paras[part3_idx + 1:part4_idx]
        lines = [line for line in lines if not line.startswith("Below are") and not line.startswith("(")]
        i = 0
        while i < len(lines) - 1:
            vi = lines[i]
            en = lines[i + 1]
            pairs.append((en, vi))
            i += 2

    vocabulary = []
    for i, w in enumerate(words_raw, 1):
        # find matching pair
        ex_en, ex_vi = "", ""
        if i - 1 < len(pairs):
            ex_en, ex_vi = pairs[i - 1]
        vocabulary.append({
            "no": i,
            "word": w["word"],
            "ipa": clean_ipa(OXFORD_IPA.get(w["word"]) or w["ipa"]),
            "pos": w["pos"],
            "meaningVi": cap_first(w["meaningVi"]),
            "icon": WORD_ICONS.get(w["word"], "❓"),
            "exampleEn": ex_en,
            "exampleVi": ex_vi,
            "audioWord": f"/audio/units/unit-09/vocab_{i:02d}_word.mp3",
            "audioExample": f"/audio/units/unit-09/vocab_{i:02d}_example.mp3",
        })

    # Interactive Q&A dialogue turns between David and Kathryn
    dialogue_turns = [
        {"no": 1, "speaker": "David", "lineEn": "Is it fun to ask questions in class?", "lineVi": "Việc đặt câu hỏi trong lớp có vui không?", "boldWords": ["questions"]},
        {"no": 2, "speaker": "Kathryn", "lineEn": "Yes, it is very fun to ask questions to learn more. It makes the conversation lively!", "lineVi": "Có chứ, đặt câu hỏi để học hỏi thêm rất vui. Nó làm cuộc trò chuyện sôi nổi!", "boldWords": ["yes", "questions", "conversation"]},
        {"no": 3, "speaker": "David", "lineEn": "Who is calling you on the phone?", "lineVi": "Ai đang gọi cho bạn trên điện thoại vậy?", "boldWords": ["who"]},
        {"no": 4, "speaker": "Kathryn", "lineEn": "No one is calling right now, but I have a question about our lesson.", "lineVi": "Không ai gọi lúc này cả, nhưng tôi có một câu hỏi về bài học của chúng ta.", "boldWords": ["no", "question"]},
        {"no": 5, "speaker": "David", "lineEn": "What would you like to ask?", "lineVi": "Bạn muốn hỏi điều gì?", "boldWords": ["what", "ask"]},
        {"no": 6, "speaker": "Kathryn", "lineEn": "Where is the best place to practice English speaking?", "lineVi": "Nơi tốt nhất để luyện nói tiếng Anh ở đâu?", "boldWords": ["where"]},
        {"no": 7, "speaker": "David", "lineEn": "You can practice right here in our one-on-one coaching sessions!", "lineVi": "Bạn có thể luyện tập ngay tại đây trong các buổi học kèm 1-1 của chúng ta!"},
        {"no": 8, "speaker": "Kathryn", "lineEn": "When does our next practice session start?", "lineVi": "Khi nào buổi luyện tập tiếp theo của chúng ta bắt đầu?", "boldWords": ["when"]},
        {"no": 9, "speaker": "David", "lineEn": "It starts tomorrow morning. Why do you enjoy learning English so much?", "lineVi": "Buổi học bắt đầu vào sáng mai. Tại sao bạn lại thích học tiếng Anh đến vậy?", "boldWords": ["why"]},
        {"no": 10, "speaker": "Kathryn", "lineEn": "Because I want to travel and communicate confidently with everyone.", "lineVi": "Vì tôi muốn đi du lịch và tự tin giao tiếp với mọi người.", "boldWords": ["information"]},
        {"no": 11, "speaker": "David", "lineEn": "How do you practice new vocabulary at home?", "lineVi": "Bạn luyện từ vựng mới ở nhà như thế nào?", "boldWords": ["how"]},
        {"no": 12, "speaker": "Kathryn", "lineEn": "I review honeycomb flashcards and play matching games every day.", "lineVi": "Tôi ôn thẻ từ vựng tổ ong và chơi game ghép nghĩa mỗi ngày.", "boldWords": ["answer"]},
        {"no": 13, "speaker": "David", "lineEn": "Please respond to this question: Can you clarify the main point?", "lineVi": "Hãy trả lời câu hỏi này: Bạn có thể làm rõ ý chính không?", "boldWords": ["respond", "clarify", "point"]},
        {"no": 14, "speaker": "Kathryn", "lineEn": "Yes, I will get to the point and be polite when speaking.", "lineVi": "Vâng, tôi sẽ đi thẳng vào vấn đề và luôn lịch sự khi nói.", "boldWords": ["polite", "point"]},
        {"no": 15, "speaker": "David", "lineEn": "Don't beat around the bush, your progress is clear as day!", "lineVi": "Không cần nói vòng vo, sự tiến bộ của bạn rõ như ban ngày!", "boldWords": ["bush", "clear"]},
        {"no": 16, "speaker": "Kathryn", "lineEn": "Thank you, David! I am ready to open the floor for more practice.", "lineVi": "Cảm ơn David! Tôi sẵn sàng mở đầu để luyện tập nhiều hơn.", "boldWords": ["floor"]},
    ]

    return {
        "unitNumber": 9,
        "titleEn": "Yes/No and Wh- Questions",
        "titleVi": "Câu hỏi Yes/No và câu hỏi Wh-",
        "slug": "unit-09",
        "contextVi": "Hội thoại giữa David và Kathryn: Câu hỏi Yes/No và câu hỏi Wh-.",
        "vocabulary": vocabulary,
        "dialogueTurns": dialogue_turns,
    }, []


def build_unit(folder):
    n = int(re.search(r"UNIT\s*(\d+)", os.path.basename(folder), re.I).group(1))
    if n == 9:
        return build_unit_9(folder)

    full = [f for f in glob.glob(os.path.join(folder, "*.html")) if re.search(r"full\.html$", f, re.I)]
    docxs = [f for f in glob.glob(os.path.join(folder, "*.docx")) if not os.path.basename(f).startswith("~$")]
    main_docx = [f for f in docxs if re.match(r"unit\s*\d", os.path.basename(f), re.I)]
    if not main_docx and len(docxs) == 1:
        main_docx = docxs
    elif not main_docx and docxs:
        main_docx = [docxs[0]]

    if len(full) != 1 or len(main_docx) != 1:
        raise ValueError(f"unit {n}: expected 1 FULL.html and 1 main docx, got {full} {main_docx}")

    html = open(full[0], encoding="utf-8").read()
    vocab_src = extract_js_array(html, "vocabulary")
    dialogue_src = extract_js_array(html, "dialogue")
    
    # Try reflexiveSentences, fallback to sentences
    try:
        reflexive_src = extract_js_array(html, "reflexiveSentences")
    except ValueError:
        reflexive_src = extract_js_array(html, "sentences")

    title_en, title_vi, table_rows, docx_speaker_lines = parse_docx(main_docx[0])

    d_html_files = glob.glob(os.path.join(folder, "*dialogue*.html"))
    speaker_lines = []
    if d_html_files:
        try:
            with open(d_html_files[0], encoding="utf-8") as _df:
                speaker_lines = re.findall(r'\{\s*speaker:\s*["\']([^"\']+)["\']\s*,\s*en:\s*["\'](.*?)["\']', _df.read())
        except Exception:
            speaker_lines = []
    if not speaker_lines:
        speaker_lines = docx_speaker_lines

    try:
        questions_src = extract_js_array(html, "questions")
    except ValueError:
        questions_src = []

    pools = [
        [(x.get("english", ""), x.get("vietnamese", "")) for x in reflexive_src],
        [(x.get("english", ""), x.get("vietnamese", "")) for x in dialogue_src],
        [(x.get("answer_english", ""), x.get("answer_vietnamese", "")) for x in questions_src],
    ]

    entries = [
        {"word": strip_tags(v["english"]), "ipa": v.get("phonetic", ""), "meaningVi": strip_tags(v["vietnamese"])}
        for v in vocab_src
    ]
    seen = {vocab_key(e["word"]) for e in entries}
    for key, row in table_rows.items():
        if key not in seen:
            entries.append({"word": key, "ipa": row["ipa"], "meaningVi": row["meaningVi"]})

    vocabulary = []
    for i, e in enumerate(entries, 1):
        key = vocab_key(e["word"])
        ex = find_example(key, pools)
        row = table_rows.get(key, {})
        vocabulary.append(
            {
                "no": i,
                "word": e["word"],
                "ipa": clean_ipa(OXFORD_IPA.get(e["word"]) or e["ipa"] or row.get("ipa", "")),
                "pos": normalize_pos(row.get("pos", "")),
                "meaningVi": cap_first(e["meaningVi"]),
                "icon": WORD_ICONS.get(e["word"], "📘"),
                "exampleEn": strip_tags(ex[0]) if ex else "",
                "exampleVi": strip_tags(ex[1]) if ex else "",
                "audioWord": f"/audio/units/unit-{n:02d}/vocab_{i:02d}_word.mp3",
                "audioExample": f"/audio/units/unit-{n:02d}/vocab_{i:02d}_example.mp3",
            }
        )

    renames = SPEAKER_RENAMES.get(n, {})
    used = set()
    turns = []
    warnings = []
    last_speaker = None
    speakers_in_order = []
    for s, _ in speaker_lines:
        if s not in speakers_in_order:
            speakers_in_order.append(s)
    if not speakers_in_order:
        speakers_in_order = ["Mr. Leo", "Ms. Miu"]

    for i, d in enumerate(dialogue_src, 1):
        idx, score = best_speaker(d["english"], speaker_lines, used)
        if idx is None or score < 0.5:
            speaker = next((s for s in speakers_in_order if s != last_speaker), speakers_in_order[0])
            warnings.append(f"unit {n} turn {i}: weak speaker match ({score:.2f}) -> {speaker}")
        else:
            used.add(idx)
            speaker = speaker_lines[idx][0]
        last_speaker = speaker
        turns.append(
            {
                "no": i,
                "speaker": renames.get(speaker, speaker),
                "lineEn": strip_tags(d["english"]),
                "lineVi": strip_tags(d["vietnamese"]),
                "boldWords": bold_words(d["english"]),
            }
        )

    speakers = [renames.get(s, s) for s in speakers_in_order[:2]]
    if len(speakers) == 1:
        speakers.append("Partner")

    return {
        "unitNumber": n,
        "titleEn": title_en,
        "titleVi": cap_first(title_vi.lower()),
        "slug": f"unit-{n:02d}",
        "contextVi": f"Hội thoại giữa {speakers[0]} và {speakers[1]}: {title_vi.lower()}.",
        "vocabulary": vocabulary,
        "dialogueTurns": turns,
    }, warnings


def main():
    folders = sorted(
        (f for f in glob.glob(os.path.join(CONTENT, "UNIT *")) if os.path.isdir(f)),
        key=lambda f: int(re.search(r"UNIT\s*(\d+)", os.path.basename(f), re.I).group(1)),
    )
    units, all_warnings = [], []
    for f in folders:
        unit, warnings = build_unit(f)
        units.append(unit)
        all_warnings += warnings
        missing_ex = sum(1 for v in unit["vocabulary"] if not v["exampleEn"])
        missing_pos = sum(1 for v in unit["vocabulary"] if not v["pos"])
        print(
            f"Unit {unit['unitNumber']:2d}: {unit['titleEn']:35} | {len(unit['vocabulary']):2d} words "
            f"({missing_ex:2d} no ex, {missing_pos:2d} no pos) | {len(unit['dialogueTurns']):2d} turns"
        )
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(units, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"\nParsed total {len(units)} units successfully!")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
