import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <h1>This page slipped away.</h1>
      <p>Let’s get you back to a good conversation.</p>
      <Link className="button button-primary" href="/@stella">
        Meet Stella
      </Link>
    </main>
  );
}
