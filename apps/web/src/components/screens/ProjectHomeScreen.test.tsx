import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { router } from "@/router";

describe("ProjectHomeScreen", () => {
	it("renders the fixture-backed board without subscription loops", async () => {
		router.update({ history: createMemoryHistory({ initialEntries: ["/projects/proj_1"] }) });
		render(<RouterProvider router={router} />);

		expect(await screen.findByRole("heading", { name: "All issues" })).toBeInTheDocument();
		expect(screen.getByText("VER-042")).toBeInTheDocument();
	});
});
