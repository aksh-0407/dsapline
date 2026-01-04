# DSApline

**Master Algorithms through Radical Accountability.**

DSApline is a platform designed for competitive programmers to track, visualize, and archive their coding journey across platforms like LeetCode, Codeforces, and HackerRank. It emphasizes consistency through streaks, deep analytics, and a public portfolio of source code.

![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

This project provides a centralized dashboard for tracking competitive programming progress. Unlike standard tracking tools, DSApline integrates directly with GitHub, ensuring that every submission contributes to a personal, version-controlled code archive.

## Key Features

-   **Unified Portfolio:** Aggregates solutions from LeetCode, Codeforces, and HackerRank into a single interface.
-   **Deep Analytics:** Visualizes difficulty distribution, tracks active days, and calculates consistency metrics using a contribution graph.
-   **Code Archive:** A searchable repository of all past solutions, filterable by tag, difficulty, and platform.
-   **Leaderboard:** A ranking system based on total problems solved and current active streaks.
-   **Serverless Architecture:** Utilizes a zero-database approach where data is stored as JSON and source code files directly within the repository via the GitHub API.

## Architecture

DSApline uses a "Repository as Database" architecture. The application does not rely on a traditional SQL or NoSQL database for persistence.

1.  **Submission:** When a user logs a solution, the application uses the GitHub API to commit a JSON metadata file and the source code file (e.g., `.cpp`, `.py`) into the `data/submissions` directory.
2.  **Indexing:** A global index (`data/index.json`) is updated automatically to ensure O(1) retrieval times for lists and search operations.
3.  **Retrieval:** Next.js fetches this data at build or request time to render static pages with dynamic updates.

## Tech Stack

-   **Framework:** Next.js 15 (App Router)
-   **Language:** TypeScript
-   **Authentication:** Clerk
-   **Styling:** Tailwind CSS
-   **Icons:** Lucide React
-   **Storage:** GitHub API

## Getting Started

### Prerequisites

-   Node.js 18.0.0 or later
-   A GitHub Account (for the Personal Access Token)
-   A Clerk Account (for Authentication)

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/aksh-0407/DSApline.git](https://github.com/aksh-0407/DSApline.git)
    cd DSApline
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env.local` file in the root directory and add the following keys:
    ```env
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    GITHUB_TOKEN=ghp_...
    ```
    *Note: The `GITHUB_TOKEN` requires `repo` scope permissions to read/write data.*

4.  **Run the development server**
    ```bash
    npm run dev
    ```

    The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

-   `app/` - Next.js App Router pages and API routes.
-   `components/` - Reusable UI components.
-   `lib/` - Core business logic, analytics engines, and GitHub API wrappers.
-   `data/` - The storage directory for submissions and indices.
-   `public/` - Static assets.

## Deployment

This project is optimized for deployment on Vercel.

1.  Push the repository to GitHub.
2.  Import the project into Vercel.
3.  Configure the environment variables (`CLERK_SECRET_KEY`, `GITHUB_TOKEN`, etc.) in the Vercel project settings.
4.  Deploy.

## License

This project is licensed under the MIT License.