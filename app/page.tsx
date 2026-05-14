import { redirect } from "next/navigation";

// Root redirects to /book — the app's only public surface
export default function Home() {
  redirect("/book");
}
