export function getLastPage(header: string | undefined) {
	if (!header) {
		throw Error("No pagination link header");
	}

	const paginationlinks = header
		.split(",")
		.reduce<Record<string, string>>((links, part) => {
			const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
			if (match) {
				const url = match[1];
				const rel = match[2];
				links[rel] = url;
			}
			return links;
		}, {});

	if (!paginationlinks.last) {
		throw Error("Missing last page link");
	}
	const lastPageUrl = new URL(paginationlinks.last);
	const rawLastPage = lastPageUrl.searchParams.get("page");
	const lastPage = rawLastPage ? parseInt(rawLastPage, 10) : undefined;

	if (!lastPage || isNaN(lastPage)) {
		throw Error("Invalid last page link");
	}

	return lastPage;
}
