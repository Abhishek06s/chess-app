import React, { useRef, useState } from "react";
import { Bot, Camera, Loader2, X } from "lucide-react";

const SIZE_CLASSES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-9 h-9 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

const ICON_SIZE_CLASSES = {
  xs: "w-3.5 h-3.5",
  sm: "w-4.5 h-4.5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-11 h-11",
};

const Avatar = ({
  src,
  username = "",
  isBot = false,
  size = "md",
  className = "",
  editable = false,
  uploading = false,
  onFileSelected,
  onRemove,
}) => {
  const fileInputRef = useRef(null);
  const [imgError, setImgError] = useState(false);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSizeClass = ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md;

  const showImage = Boolean(src) && !imgError && !isBot;

  const handlePick = () => fileInputRef.current?.click();

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (file && typeof onFileSelected === "function") {
      onFileSelected(file);
    }
  };

  let content;
  if (showImage) {
    content = (
      <img
        src={src}
        alt={`${username || "Player"}'s avatar`}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-zinc-700/60 shadow-inner`}
      />
    );
  } else if (isBot) {
    content = (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center bg-linear-to-br from-amber-500/30 to-orange-600/30 border border-amber-500/40 text-amber-300 shadow-inner`}
        title="Bot"
      >
        <Bot className={iconSizeClass} />
      </div>
    );
  } else {
    // Default "pawn" avatar — used for guests, unregistered PGN players,
    // and any registered user before they set a custom avatar.
    content = (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center bg-linear-to-br from-zinc-600 to-zinc-800 border border-zinc-500/40 text-zinc-300 shadow-inner`}
        title={username || "Player"}
      >
        <span className="leading-none select-none" style={{ fontSize: "1.4em" }}>
          ♟
        </span>
      </div>
    );
  }

  if (!editable) {
    return <div className={`relative shrink-0 ${className}`}>{content}</div>;
  }

  return (
    <div className={`relative shrink-0 group ${className}`}>
      {content}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        title="Change avatar"
        className={`absolute inset-0 ${sizeClass} rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/60 text-transparent group-hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed`}
      >
        {uploading ? (
          <Loader2 className={`${iconSizeClass} animate-spin text-white`} />
        ) : (
          <Camera className={iconSizeClass} />
        )}
      </button>

      {showImage && !uploading && typeof onRemove === "function" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove avatar"
          className="absolute -top-1 -right-1 p-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-rose-600 hover:border-rose-600 transition-all cursor-pointer shadow-md"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default Avatar;