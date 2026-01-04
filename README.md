# ⚡ DSAPline

> **Master Algorithms through Radical Accountability.**

DSAPline is a platform designed for competitive programmers to track, visualize, and archive their coding journey across platforms like LeetCode, Codeforces, and HackerRank. It emphasizes consistency through streaks, deep analytics, and a public portfolio of your code.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Stack](https://img.shields.io/badge/built%20with-Next.js_15-black)

## 🚀 Features

-   **Unified Portfolio:** Bring all your solutions from LeetCode, Codeforces, and others under one roof.
-   **Deep Analytics:** Visualise difficulty distribution, track active days, and monitor your consistency with a GitHub-style heatmap.
-   **Code Archive:** A searchable, filterable repository of every problem you've ever solved. Never lose a solution again.
-   **Hall of Fame:** A competitive leaderboard ranking "Whizzes" by problems solved and highest active streaks.
-   **Serverless Architecture:** A unique zero-database approach where all data is stored as JSON and source code files directly in the repository via the GitHub API.

## 🛠️ Tech Stack

-   **Framework:** Next.js 15 (App Router)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Authentication:** Clerk
-   **Icons:** Lucide React
-   **Database:** GitHub API (File-System based)
-   **Deployment:** Vercel

## 🏗️ Architecture: "The Repo is the Database"

DSAPline uses a novel architecture where **GitHub itself acts as the database**.
When a user submits a solution:
1.  The app uses the GitHub API to commit a JSON metadata file and the code file (e.g., `.cpp`, `.py`) into the `data/submissions` folder.
2.  The global index (`data/index.json`) is updated automatically.
3.  Next.js fetches this data at build/request time to render static pages with dynamic updates.

This ensures your data is portable, version-controlled, and belongs 100% to you.

## 🏁 Getting Started

### Prerequisites

-   Node.js 18+
-   A GitHub Account (for the Personal Access Token)
-   A Clerk Account (for Authentication)

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/aksh-0407/dsapline.git](https://github.com/aksh-0407/dsapline.git)
    cd dsapline
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    GITHUB_TOKEN=ghp_...
    ```
    *Note: The `GITHUB_TOKEN` requires `repo` scope permissions.*

4.  **Run the development server**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📂 Project Structure
dsapline/ ├── app/ # Next.js App Router pages ├── components/ # Reusable UI components (Heatmap, StatsGrid, etc.) ├── lib/ # Core logic (Analytics, GitHub API wrappers) ├── data/ # THE DATABASE (Do not touch manually) │ ├── submissions/ # Stores code and metadata JSONs │ └── index.json # Master index for fast lookups └── public/ # Static assets

## 🚀 Deployment

This project is optimized for **Vercel**.

1.  Push your code to GitHub.
2.  Import the project in Vercel.
3.  Add the Environment Variables (`CLERK_KEY`, `GITHUB_TOKEN`, etc.) in the Vercel Dashboard.
4.  Deploy!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License.

---

> Built with 💻 and ☕ by **Aksh**.