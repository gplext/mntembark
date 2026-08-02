import { useRef } from 'react';
import { useUpload, type UploadResponse } from '@workspace/object-storage-web';
import { Upload, X, ImageIcon } from 'lucide-react';

/** Convert objectPath (e.g. /objects/uploads/uuid) to a serving URL */
function toServingUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  'data-testid'?: string;
}

/**
 * Single-image upload field.
 * - Shows a drag-drop / click zone that triggers file upload
 * - After upload, sets value to the serving URL (/api/storage/objects/...)
 * - Existing URLs (/images/...) are preserved and displayed as thumbnails
 * - Also provides a URL text input as a fallback for backward compatibility
 */
export function ImageUploadField({
  value,
  onChange,
  label,
  required,
  'data-testid': testId,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress, error } = useUpload({
    onSuccess: (response) => {
      onChange(toServingUrl(response.objectPath));
    },
  });

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      {label && (
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block">
          {label}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !isUploading && inputRef.current?.click()}
        className="relative border border-dashed border-border/60 rounded cursor-pointer hover:border-primary/50 transition-colors group"
        style={{ minHeight: '80px' }}
      >
        {value ? (
          /* Thumbnail preview */
          <div className="relative flex items-center gap-3 p-3">
            <img
              src={value}
              alt="Preview"
              className="h-16 w-24 object-cover rounded shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-xs text-muted-foreground truncate">{value}</p>
              <p className="font-sans text-xs text-primary mt-1 group-hover:underline">
                Click or drop to replace
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground group-hover:text-foreground transition-colors">
            {isUploading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="font-sans text-xs">Uploading… {Math.round(progress)}%</p>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <p className="font-sans text-xs">Drop image or click to upload</p>
              </>
            )}
          </div>
        )}

        {/* Uploading overlay */}
        {isUploading && value && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="font-sans text-xs text-foreground">{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="font-sans text-xs text-destructive">{error.message}</p>
      )}

      {/* URL text fallback */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder="Or paste an image URL…"
        className="w-full bg-background border border-border/60 rounded px-3 py-2 font-sans text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
        data-testid={testId ? `${testId}-url-input` : undefined}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

interface ImageGalleryUploadFieldProps {
  values: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  'data-testid'?: string;
}

/**
 * Multi-image upload field — manages an array of image URLs.
 * Each image can be replaced or removed individually.
 * A "+" button uploads and appends a new image.
 */
export function ImageGalleryUploadField({
  values,
  onChange,
  label,
  'data-testid': testId,
}: ImageGalleryUploadFieldProps) {
  const addInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      onChange([...values, toServingUrl(response.objectPath)]);
    },
  });

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      e.target.value = '';
    }
  };

  const removeImage = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  const updateUrl = (idx: number, url: string) => {
    onChange(values.map((v, i) => (i === idx ? url : v)));
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      {label && (
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block">
          {label}
        </label>
      )}

      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {url && (
                <img
                  src={url}
                  alt={`Image ${idx + 1}`}
                  className="h-10 w-14 object-cover rounded shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <input
                type="text"
                value={url}
                onChange={(e) => updateUrl(idx, e.target.value)}
                placeholder="Image URL"
                className="flex-1 bg-background border border-border/60 rounded px-3 py-1.5 font-sans text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => !isUploading && addInputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
        <span className="font-sans text-xs">
          {isUploading ? 'Uploading…' : 'Upload image'}
        </span>
      </button>

      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAddFile}
      />
    </div>
  );
}
