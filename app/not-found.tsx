import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <h1>This page slipped away.</h1>
      <p>This creator link may have changed or is no longer available.</p>
      <Link className="button button-primary" href="/">
        Go to ReplyPass
      </Link>
    </main>
  );
}
