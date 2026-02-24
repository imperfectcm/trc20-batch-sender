# TRC20 Batch Sender

A web-based tool for performing batch TRC20 USDT transfers on the TRON blockchain. Built with Next.js and TronWeb, it streamlines multi-recipient transfers with automatic energy rental and transaction resume support.
### [Vercel App Url](https://the-trc20-batch-sender.vercel.app/)
<img width="2775" height="1728" alt="螢幕擷取畫面 2026-02-24 155917" src="https://github.com/user-attachments/assets/55cf1c4d-b9d4-4e18-9d10-b7e4e11ca090" />

###

![mpv-shot0001](https://github.com/user-attachments/assets/fe51985c-8da4-4ef1-9d85-ead456b2107f)
![mpv-shot0002](https://github.com/user-attachments/assets/38839049-c5c8-4963-8989-22c0c5384580)

###

## Features

- **Batch Transfers** — Send USDT to multiple recipients in a single contract call, saving time and reducing overhead
- **Auto Energy Rental** — Automatically estimates required energy before transfer and rents it on-demand to minimize TRX burn as gas fees
- **Resume Mechanism** — Automatically resumes interrupted transactions (energy rental, approval, or transfer confirmation) after page refresh or connection loss
- **TronLink Integration** — Connect via TronLink wallet adapter for secure transaction signing without exposing private keys
- **Private Key Mode** — Alternative direct signing mode for automated or headless usage
- **CSV Import** — Upload recipient lists via CSV file for bulk transfer preparation
- **Simulate Before Send** — Estimate energy cost before committing to a transfer
- **Transaction Records** — View historical TRC20 transfer records for the active wallet
- **Mainnet / Shasta Testnet** — Supports both environments for development and production

## Tech Stack

| Category | Library |
|---|---|
| Framework | [Next.js](https://nextjs.org) + [Bun](https://bun.sh) |
| Blockchain | [TronWeb](https://github.com/tronprotocol/tronweb) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS |
| State Management | [Zustand](https://zustand-demo.pmnd.rs) (with localStorage persistence) |
| CSV Parsing | [PapaParse](https://www.papaparse.com) + [ReactDropzone](https://www.npmjs.com/package/react-dropzone) |
| Wallet | TronLink Adapter |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- A TronLink wallet (browser extension) or a TRON private key
- TronGrid API key (for Mainnet usage)
- TronScan API key

### Installation

```bash
git clone https://github.com/your-username/trc20-batch-sender.git
cd trc20-batch-sender
bun install
```

Create a .env.local file in the root directory reference to env.sample file

## Run Development Server

```bash
bun dev
```

Open http://localhost:3000 in your browser.

## Build for Production

```bash
bun run build
bun start
```

## Usage

- **Activate an account** — Connect via TronLink adapter or enter a private key

- **Prepare recipients** — Manually enter addresses and amounts, or import a CSV file (sample CSV file could be found in public directory)

- **Simulate** — Run an energy estimation to calculate rental cost

- **Enable Auto Energy Rental (optional)** — Let the app automatically rent energy before transfer to save on TRX fees

- **Approve & Transfer** — Approve the USDT spending allowance, then execute the batch transfer

- **Monitor** — Track confirmation status in real time; refreshing the page will automatically resume any in-progress transaction

### Disclaimer

This tool interacts directly with the TRON blockchain and handles real assets. Always test on Shasta Testnet before using on Mainnet. The authors are not responsible for any loss of funds resulting from misuse.
