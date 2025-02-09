import type { NextApiRequest, NextApiResponse } from 'next'
import { Builder, By, until } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    let { url } = req.body;

    if (!url) {
        return res.status(400).json({ message: 'URL is required' });
    }

    url = url.split('?')[0];
    
    const meetupUrlPattern = /^https:\/\/www\.meetup\.com\/[^/]+\/events\/\d+\/?$/;

    if (!meetupUrlPattern.test(url)) { 
        return res.status(400).json({ 
            message: 'URL format error', 
            body: 'Format: https://meetup.com/{hostName}/events/{eventNumber}/' 
        });
    }
    let driver = null;

    try {
        // Set up Selenium WebDriver
        const options = new chrome.Options();
        options.addArguments('--headless');

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        // Navigate to a website
        await driver.get(url);

        // Wait for data to load 
        await driver.wait(until.elementLocated(By.tagName('body')), 2000);

        // Get the page title
        const title = await driver.findElement(By.tagName('h1')).getText();

        // Get the host name
        const host = await driver.findElement(By.xpath("//*[@id='events']/div[2]/div[1]/div[1]")).getText();

        // Get the event datetime
        const dateTime = await driver.findElement(By.xpath("//time[@class='block']")).getText();
        const [dateString, timeString] = dateTime.split('\n');
        // Remove day of week and convert to Date object
        const date = new Date(new Date(dateString.split('\n')[0]).getTime() + 8 * 60 * 60 * 1000);
        const time = timeString;

        // Get venue
        const venue = await driver.findElement(By.xpath("//a[@class='hover:text-viridian hover:no-underline' and @data-testid='venue-name-link']")).getText();

        // Get fee
        const fee = await driver.findElement(By.xpath('//*[@id="main"]/div[4]/div/div/div[2]/div/div[1]/div/div/span')).getText();

        // Get availability
        const availabilityButton = await driver.findElement(By.xpath('//*[@id="main"]/div[4]/div/div/div[2]/div/div[2]/button')).getAttribute('data-testid');
        let availability = null;
        if (availabilityButton == "waitlist-btn") {
            availability = "full";
        } else if (availabilityButton == "attend-irl-btn") {
            availability = "availabile";
        } else if (availabilityButton == "pass-event-btn") {
            availability = "event_expired";
        }

        // Get image data
        const banner = await driver.findElement(By.xpath('//picture[@data-testid="event-description-image"]//img'));
        let banner_url = await banner.getAttribute('src');
        banner_url = banner_url.split('?')[0];
        const banner_alt = await banner.getAttribute('alt');

        res.status(200).json({ title, host, date, time, venue, fee, availability, url, banner_url, banner_alt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while scraping' });
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}