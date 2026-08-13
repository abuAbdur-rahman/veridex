import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Mcp } from "@/components/landing/Mcp";
import { Problem } from "@/components/landing/Problem";
import { Workflow } from "@/components/landing/Workflow";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export function LandingPage() {
	return (
		<>
			<Navbar />
			<main>
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
