"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.puppeteerService = exports.PuppeteerService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
class PuppeteerService {
    constructor() {
        this.browser = null;
    }
    async getBrowser() {
        if (this.browser && this.browser.connected) {
            return this.browser;
        }
        this.browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        return this.browser;
    }
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
exports.PuppeteerService = PuppeteerService;
exports.puppeteerService = new PuppeteerService();
