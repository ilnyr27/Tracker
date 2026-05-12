"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Camera,
  Upload,
  Star,
  Trash2,
  X,
  ImageIcon,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Photo } from "@/lib/supabase/types";

type Tab = "all" | "best";

const BEST_LABELS: { key: keyof Photo; label: string }[] = [
  { key: "is_photo_of_day", label: "Дня" },
  { key: "is_photo_of_week", label: "Недели" },
  { key: "is_photo_of_month", label: "Месяца" },
  { key: "is_photo_of_season", label: "Сезона" },
  { key: "is_photo_of_year", label: "Года" },
];

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("photos")
      .select("*")
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data) setPhotos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date();

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userData.user.id}/${today}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      await supabase.from("photos").insert({
        user_id: userData.user.id,
        photo_date: today,
        storage_path: path,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        week: getWeekNumber(now),
        sort_order: photos.length,
      });
    }

    setUploading(false);
    loadPhotos();
  }

  async function deletePhoto(photo: Photo) {
    const supabase = createClient();
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await supabase.from("photos").delete().eq("id", photo.id);
  }

  async function toggleBest(
    photo: Photo,
    field: keyof Photo
  ) {
    const supabase = createClient();
    const newVal = !photo[field];

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id ? { ...p, [field]: newVal } : p
      )
    );
    setSelectedPhoto((prev) =>
      prev && prev.id === photo.id ? { ...prev, [field]: newVal } : prev
    );

    await supabase
      .from("photos")
      .update({ [field]: newVal })
      .eq("id", photo.id);
  }

  function getPhotoUrl(path: string) {
    const supabase = createClient();
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  }

  // Group by date
  const grouped = photos.reduce(
    (acc, photo) => {
      const date = photo.photo_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(photo);
      return acc;
    },
    {} as Record<string, Photo[]>
  );

  const bestPhotos = photos.filter(
    (p) =>
      p.is_photo_of_day ||
      p.is_photo_of_week ||
      p.is_photo_of_month ||
      p.is_photo_of_season ||
      p.is_photo_of_year
  );

  const displayPhotos = tab === "best" ? bestPhotos : photos;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold gradient-text">Фото-дневник</h1>
        <Button
          size="sm"
          className="gradient-primary text-white border-0 hover:opacity-90"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? "Загрузка..." : "Загрузить"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["all", "best"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              relative px-4 py-1.5 rounded-xl text-xs font-medium transition-all
              ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            {tab === t && (
              <motion.div
                layoutId="photos-tab"
                className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-1">
              {t === "all" ? (
                <>
                  <Camera className="h-3.5 w-3.5" /> Все
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" /> Лучшие
                </>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-card animate-pulse"
            />
          ))}
        </div>
      ) : displayPhotos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {tab === "best"
              ? "Нет избранных фото. Выбери лучшие из галереи!"
              : "Пока нет фото. Загрузи первое!"}
          </p>
        </motion.div>
      ) : tab === "all" ? (
        // Grouped by date
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, datePhotos]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {format(new Date(date + "T00:00:00"), "d MMMM yyyy", {
                    locale: ru,
                  })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {datePhotos.map((photo) => (
                  <PhotoThumbnail
                    key={photo.id}
                    photo={photo}
                    url={getPhotoUrl(photo.storage_path)}
                    onClick={() => setSelectedPhoto(photo)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Best photos grid
        <div className="grid grid-cols-2 gap-3">
          {bestPhotos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              url={getPhotoUrl(photo.storage_path)}
              onClick={() => setSelectedPhoto(photo)}
              showBadges
            />
          ))}
        </div>
      )}

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full max-h-[85vh] flex flex-col bg-card rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Image */}
              <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                <img
                  src={getPhotoUrl(selectedPhoto.storage_path)}
                  alt=""
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>

              {/* Actions */}
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {format(
                    new Date(selectedPhoto.photo_date + "T00:00:00"),
                    "d MMMM yyyy",
                    { locale: ru }
                  )}
                </p>

                {/* Best-of toggles */}
                <div className="flex flex-wrap gap-2">
                  {BEST_LABELS.map(({ key, label }) => {
                    const isActive = !!selectedPhoto[key];
                    return (
                      <button
                        key={key}
                        onClick={() =>
                          toggleBest(selectedPhoto, key)
                        }
                        className={`
                          flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                          ${isActive
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/50 text-muted-foreground hover:border-primary/30"
                          }
                        `}
                      >
                        <Star
                          className={`h-3 w-3 ${isActive ? "fill-primary" : ""}`}
                        />
                        Фото {label}
                      </button>
                    );
                  })}
                </div>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    deletePhoto(selectedPhoto);
                    setSelectedPhoto(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Удалить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhotoThumbnail({
  photo,
  url,
  onClick,
  showBadges = false,
}: {
  photo: Photo;
  url: string;
  onClick: () => void;
  showBadges?: boolean;
}) {
  const hasBest =
    photo.is_photo_of_day ||
    photo.is_photo_of_week ||
    photo.is_photo_of_month ||
    photo.is_photo_of_season ||
    photo.is_photo_of_year;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
    >
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
      />
      {hasBest && (
        <div className="absolute top-1.5 right-1.5">
          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 drop-shadow" />
        </div>
      )}
      {showBadges && (
        <div className="absolute bottom-1.5 left-1.5 flex gap-1 flex-wrap">
          {BEST_LABELS.filter(({ key }) => !!photo[key]).map(({ key, label }) => (
            <Badge
              key={key}
              className="text-[9px] px-1 py-0 bg-black/60 text-white border-0"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}
    </motion.button>
  );
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}
