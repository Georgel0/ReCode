"use client";

export function EmptyPlaceholder({ icon = "fa-check-circle", title, message }) {
  return (
    <div className="empty-placeholder">
      <i className={`fa-solid ${icon}`}></i>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
