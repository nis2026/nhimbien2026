import type { Metadata } from "next";
import { getUnitBySlug } from "@/data/units";
import { UnitDetailClient } from "./UnitDetailClient";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const unit = getUnitBySlug(slug);
  if (!unit) return {};

  const title = `Bài ${unit.unitNumber}: ${unit.titleEn} — ${unit.titleVi}`;
  const description = `${unit.vocabulary.length} từ vựng · Hội thoại ${unit.dialogueTurns.length} lượt lời · ${
    unit.youtubeUrl ? "Kèm video bài học" : "VIP Coach Ms. Nhím Biển"
  } — ${unit.contextVi}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: unit.coverImage, width: 960, height: 540, alt: unit.titleEn }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [unit.coverImage],
    },
  };
}

export default async function UnitDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <UnitDetailClient slug={slug} />;
}
