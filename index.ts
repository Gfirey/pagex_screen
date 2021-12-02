/* tslint:disable:no-console */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface IPagexs {
    [key: string]: string
}

const LOGIN = 'Бетмен';
const PASSWORD = 'Бетмен1234';
const SERVER = 'https://test-online.sbis.ru';
const DATA_FILE_NAME = 'data.json';
const PUPPETEER_OPTIONS = {
    headless: false,
    defaultViewport: {
        width: 1024,
        height: 768
    }
};

const getPageIds = (searchText: string): string[] => {
    const pageIds = [];

    const code = document.getElementsByTagName('code')[0].innerText;
    const arr = code.split(searchText);
    const reducer = (rr: string[], x: string, index: number) => {
        if (index < (arr.length - 1)) {
            x = x.slice(x.lastIndexOf('id=') + 4);
            rr.push(x.slice(0, x.indexOf('"')));
        }
        return rr;
    };
    return arr.reduce(reducer, []);
};

const parseJSON = (): { searchText: string, pagexs: IPagexs } => {
    const searchData = JSON.parse(fs.readFileSync(path.resolve(path.dirname(__dirname), DATA_FILE_NAME), 'utf8'));
    const searchText = searchData.settings.text[0];
    const pagexs: IPagexs = {};
    for (const repoName in searchData) {
        if (repoName.startsWith('https://')) {
            for (const pagexName in searchData[repoName]) {
                if (pagexName.endsWith('.pagex')) {
                    const pagex = searchData[repoName][pagexName];
                    for (const line in pagex) {
                        if (pagex.hasOwnProperty(line)) {
                            pagexs[pagexName] = pagex[line].path;
                        }
                    }
                }
            }
        }
    }
    return {searchText, pagexs};
};

(async () => {

    const {searchText, pagexs} = parseJSON();

    const browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();

    for (const pagex in pagexs) {
        if (pagexs.hasOwnProperty(pagex)) {
            const pathToGit = pagexs[pagex];
            await page.goto(pathToGit);
            await page.waitForSelector('code', {
                visible: true,
            });

            const pageIds = await page.evaluate(getPageIds, searchText);
            for (const pageId of pageIds) {
                const cookies = [{
                    name: 's3online-theme',
                    value: 'default/onlinenavigation'
                }, {
                    name: 'lang',
                    value: 'Ru-ru'
                }];
                await page.setCookie(...cookies);
                await page.goto(SERVER + '/page/' + pageId);

                await page.waitForNavigation().catch(() => {console.log(pageId)});
                // auth
                if (page.url().includes('-sso.')) {
                    await page.type('input[name=login]', LOGIN);
                    await page.type('input[name=password]', PASSWORD);
                    await page.click('.auth-Form__submit');
                    await page.waitForNavigation();
                }
                await page.screenshot({path: pageId + '.png'});
            }
        }
    }
    await browser.close();
})();
