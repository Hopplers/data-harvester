import { chromium } from 'playwright-core';
import chromiumExecutable from '@sparticuz/chromium';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const cleanedUrl = url.split('?')[0];

  try {
    if (cleanedUrl.includes('meetup.com')) {
      return await scrapeMeetup(cleanedUrl);
    } else if (cleanedUrl.includes('lu.ma')) {
      return await scrapeLuma(cleanedUrl);
    } else {
      return Response.json(
        {
          error:
            'This function only supports meetup and luma links for now, do expect more updates to come',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return Response.json(
      {
        error: 'An error occurred while scraping',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function scrapeMeetup(cleanedUrl: string) {
  const meetupUrlPattern =
    /^https:\/\/www\.meetup\.com\/[^/]+\/events\/\d+\/?$/;
  if (!meetupUrlPattern.test(cleanedUrl)) {
    return Response.json(
      {
        error: 'URL format error',
        message: 'Format: https://meetup.com/{hostName}/events/{eventCode}/',
      },
      { status: 400 }
    );
  }

  try {
    // ✅ Use prebuilt Chromium for Vercel
    const browser = await chromium.launch({
      args: [...chromiumExecutable.args, '--lang=ms-MY'],
      executablePath: await chromiumExecutable.executablePath(),
    });

    // For local
    // const browser = await chromium.launch({ chromiumSandbox: false });

    const page = await browser.newPage();

    await page.goto(cleanedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const title = await page.$eval('h1', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const host = await page.$eval(
      '#event-group-link > div > div.ml-4 > div.text-sm.font-medium.leading-5',
      (el: HTMLElement) => el.innerText.trim()
    );

    const dateTime = await page.$eval('time.block', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const [dateString, time] = dateTime.split('\n');

    const date = new Date(new Date(dateString).getTime());

    const venueElement = await page.$("a[data-testid='venue-name-link']");

    const onlineElement = await page.$("div[data-testid='venue-name-value']");

    let venue;

    if (venueElement) {
      venue = await page.evaluate(
        (el) => (el as HTMLElement).innerText.trim(),
        venueElement
      );
    } else if (onlineElement) {
      venue = await page.evaluate(
        (el) => (el as HTMLElement).innerText.trim(),
        onlineElement
      );
    } else {
      venue = 'Unable to find venue';
    }

    const fee = await page.$eval(
      'div[data-event-label="action-bar"]',
      (container: HTMLElement) => {
        return container.innerText.includes('FREE') ? 'FREE' : 'PAID';
      }
    );

    const availabilityMapping = {
      'waitlist-btn': 'waitlist',
      'attend-irl-btn': 'available',
      'pass-event-btn': 'event_expired',
      'rsvp-not-open-btn': 'not_available',
      'attend-online-btn': 'available_online',
    };

    let availability = 'unknown';

    for (const [testId, status] of Object.entries(availabilityMapping)) {
      const button = await page.$(`[data-testid="${testId}"]`);
      if (button) {
        availability = status;
        break;
      }
    }

    const bannerElement = await page.$(
      'picture[data-testid="event-description-image"] img'
    );

    const banner_url = bannerElement
      ? await bannerElement.evaluate(
          (el: HTMLImageElement) => el.src.split('?')[0]
        )
      : null;

    const banner_alt = bannerElement
      ? await bannerElement.evaluate((el: HTMLImageElement) => el.alt)
      : null;

    await browser.close();

    return Response.json(
      {
        title,
        host,
        date,
        time,
        venue,
        fee,
        availability,
        url: cleanedUrl,
        banner_url,
        banner_alt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Scraping error:', error);
    return Response.json(
      {
        error: 'An error occurred while scraping',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function scrapeLuma(cleanedUrl: string) {
  const lumaUrlPattern = /^https:\/\/lu\.ma\/[a-zA-Z0-9]{8}\/?$/;
  if (!lumaUrlPattern.test(cleanedUrl)) {
    return Response.json(
      {
        error: 'URL format error',
        message: 'Format: https://lu.ma/{eventCode}/',
      },
      { status: 400 }
    );
  }

  try {
    // ✅ Use prebuilt Chromium for Vercel
    const browser = await chromium.launch({
      args: [...chromiumExecutable.args, '--lang=ms-MY'],
      executablePath: await chromiumExecutable.executablePath(),
    });

    // For local
    // const browser = await chromium.launch({ chromiumSandbox: false });

    const page = await browser.newPage();
    await page.goto(cleanedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Event Detail
    const title = await page.$eval('h1', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const hostName = await page.$eval('.jsx-3733653009', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const host = hostName.includes('\n') ? hostName.split('\n')[0] : hostName;

    const date = await page.$eval('.jsx-2370077516.title', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const time = await page.$eval('.jsx-2370077516.desc', (el: HTMLElement) =>
      el.innerText.trim()
    );

    const vunueExist = await page.$('.jsx-3850535622');

    let venue;

    if (vunueExist) {
      venue = await page.$eval('.jsx-3850535622', (el: HTMLElement) =>
        el.innerText.trim()
      );
    } else {
      venue = 'Register to See Venue';
    }

    let fee = 'FREE';

    const ticketElementText = await page.$eval(
      '.jsx-2770533236',
      (el: HTMLElement) => el.innerText.trim()
    );

    if (ticketElementText == 'Get Tickets') {
      fee = 'PAID';
    }

    let availability = 'unknown';

    const registationClosedElement = await page.$('.jsx-236388194');

    const statusElement = await page.$('.jsx-825713363.title');

    if (registationClosedElement) {
      availability = 'not_available';
    } else if (statusElement) {
      const status = await page.evaluate(
        (el) => (el as HTMLElement).innerText.trim(),
        statusElement
      );
      console.log(status);
      if (status == 'Past Event') {
        availability = 'event_expired';
      } else if (status == 'Event Full') {
        availability = 'waitlist';
      } else if (status == 'Approval Required') {
        availability = 'available';
      }
    } else {
      const registerButtonText = await page.$eval(
        '.jsx-681273248 button div.label',
        (el: HTMLElement) => el.innerText.trim()
      );
      if (
        registerButtonText == 'Register' ||
        registerButtonText == 'Get Ticket'
      ) {
        availability = 'available';
      }
    }

    const bannerElement = await page.$('.jsx-4068354093 img');

    const banner_url = bannerElement
      ? await bannerElement.evaluate((el: HTMLImageElement) => el.src)
      : null;

    const banner_alt = bannerElement
      ? await bannerElement.evaluate((el: HTMLImageElement) => el.alt)
      : null;

    return Response.json(
      {
        title,
        host,
        date,
        time,
        venue,
        fee,
        availability,
        url: cleanedUrl,
        banner_url,
        banner_alt,
      },
      // { title, host, date, time, venue, fee, availability, url: cleanedUrl, banner_url, banner_alt },
      { status: 200 }
    );
  } catch (error) {
    console.error('Scraping error:', error);
    return Response.json(
      {
        error: 'An error occurred while scraping',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
