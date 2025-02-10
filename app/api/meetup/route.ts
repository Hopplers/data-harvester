import puppeteer from "puppeteer";

export async function POST(request: Request) {
    const { url } = await request.json();

    if (!url) {
        return Response.json({ error: "URL is required" }, { status: 400 });
    }

    const cleanedUrl = url.split("?")[0];
    const meetupUrlPattern = /^https:\/\/www\.meetup\.com\/[^/]+\/events\/\d+\/?$/;

    if (!meetupUrlPattern.test(cleanedUrl)) {
        return Response.json(
            {
                error: "URL format error",
                message: "Format: https://meetup.com/{hostName}/events/{eventNumber}/",
            },
            { status: 400 }
        );
    }

    let browser;
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(cleanedUrl, { waitUntil: "domcontentloaded" });

        // Extract event details
        const title = await page.$eval("h1", (el) => el.innerText.trim());
        const host = await page.$eval(
            "#event-group-link > div > div.ml-4 > div.text-sm.font-medium.leading-5",
            (el) => el.innerText.trim()
        );

        // Extract date & time
        const dateTime = await page.$eval("time.block", (el) => el.innerText.trim());
        const [dateString, time] = dateTime.split("\n");
        const date = new Date(new Date(dateString).getTime() + 8 * 60 * 60 * 1000);

        // Extract venue
        const venue = await page.$eval(
            'a[data-testid="venue-name-link"]',
            (el) => el.innerText.trim()
        );

        // Extract fee
        const fee = await page.$eval('div[data-event-label="action-bar"]', (container) => {
            return container.innerText.includes('FREE') ? 'FREE' : 'PAID';
        });

        // Extract availability
        const availabilityMapping = {
            "waitlist-btn": "waitlist",
            "attend-irl-btn": "available",
            "pass-event-btn": "event_expired",
            "rsvp-not-open-btn": "not_available"
        };

        let availability = "unknown";

        for (const [testId, status] of Object.entries(availabilityMapping)) {
            const button = await page.$(`[data-testid="${testId}"]`);
            if (button) {
                availability = status;
                break;
            }
        }

        // Extract banner image
        const bannerElement = await page.$('picture[data-testid="event-description-image"] img');
        const banner_url = bannerElement ? await bannerElement.evaluate((el) => el.src.split("?")[0]) : null;
        const banner_alt = bannerElement ? await bannerElement.evaluate((el) => el.alt) : null;

        await browser.close();

        return Response.json(
            { title, host, date, time, venue, fee, availability, url: cleanedUrl, banner_url, banner_alt },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return Response.json(
            { error: "An error occurred while scraping", message: error },
            { status: 500 }
        );
    }
}
