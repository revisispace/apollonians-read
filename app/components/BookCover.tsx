import { Headphones } from "lucide-react";

type BookCoverProps = {
  title: string;
  author: string;
  palette: string;
  large?: boolean;
};

export function BookCover({ title, author, palette, large = false }: BookCoverProps) {
  return (
    <div className={`book-cover cover-${palette}${large ? " book-cover-large" : ""}`} aria-label={`Sampul ${title}`}>
      <span className="cover-rule" />
      <div className="cover-copy">
        <span className="cover-kicker"><Headphones size={12} /> Audiobook</span>
        <strong>{title}</strong>
        <small>{author}</small>
      </div>
      <span className="cover-mark">AR</span>
    </div>
  );
}
