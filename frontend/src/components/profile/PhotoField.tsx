import { useState } from "react";
import { apiClient } from "@/api/client";
import { getErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/Input";

export function PhotoField({ onChange, onUploading }: {
  onChange: (url: string) => void;
  onUploading: (uploading: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function select(file?: File) {
    if (!file) return;
    setError("");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Selecione uma foto JPG, PNG ou WebP de até 10 MB.");
      return;
    }
    setBusy(true);
    onUploading(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); throw new Error("Não foi possível preparar a foto."); }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Foto inválida.")), 'image/jpeg', 0.85,
      ));
      const { data } = await apiClient.post<{ photo_url: string }>("/users/me/photo", blob, {
        headers: { 'Content-Type': 'image/jpeg' },
      });
      onChange(data.photo_url);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível enviar a foto."));
    } finally {
      setBusy(false);
      onUploading(false);
    }
  }

  return <Input label="Foto (opcional)" type="file" accept="image/jpeg,image/png,image/webp"
    disabled={busy} error={error} aria-busy={busy}
    className="min-w-0 max-w-full" onChange={(event) => {
      void select(event.target.files?.[0]);
      event.target.value = "";
    }} />;
}
