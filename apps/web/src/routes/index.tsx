import { createRoute } from "@tanstack/react-router";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Mcp } from "@/components/landing/Mcp";
import { Problem } from "@/components/landing/Problem";
import { Workflow } from "@/components/landing/Workflow";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { rootRoute } from "@/routes/__root";

export const IndexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: LandingPage,
});

export function LandingPage() {
	return (
		<>
			<Navbar />
			<main className="landing-page">
				<Hero />
				<Problem />
				<Workflow />
				<Mcp />
				<Features />
			</main>
			<Footer />
		</>
	);
}
