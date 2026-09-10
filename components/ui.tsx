import Image from "next/image";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}
export function Avatar({
  src,
  name,
  size = 48,
}: {
  src: string;
  name: string;
  size?: number;
}) {
  return (
    <Image
      src={src}
      unoptimized={src.startsWith("http") || src.startsWith("data:")}
      alt={name}
      width={size}
      height={size}
      className="avatar"
      style={{ width: size, height: size }}
    />
  );
}
export function Badge({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`badge ${className}`} {...props} />;
}
export function Price({
  cents,
  unit,
  decimals = false,
  currency = "EUR",
}: {
  cents: number;
  unit?: string;
  decimals?: boolean;
  currency?: string;
}) {
  return (
    <span className="price">
      {new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(cents / 100)}
      {unit && <span className="price-unit">{unit}</span>}
    </span>
  );
}
export function CreatorStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="creator-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
