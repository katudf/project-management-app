# `useScheduleData.ts` の処理概要

このファイルは、スケジュール表示に必要なデータを取得し、カレンダーコンポーネント（FullCalendarなど）が解釈できる形式に整形するためのカスタムフック `useScheduleData` を定義しています。

## 主な機能

1.  **データ取得:**
    *   Supabaseから `Projects`（案件）、`ProjectTasks`（作業項目）、`Workers`（作業員）、`Assignments`（割り当て）の4つのテーブルのデータを非同期で並行取得します。
2.  **データ整形:**
    *   取得したデータを、カレンダーの**リソース**（左側の階層表示される行）と**イベント**（右側のタイムラインに表示されるバー）という2種類のデータ構造に変換します。
3.  **状態管理:**
    *   整形したリソース、イベントのデータ、およびデータ取得中のローディング状態、エラー情報をReactの `useState` を使って管理し、コンポーネントに提供します。

---

## 処理の流れ

### 1. `fetchData` 関数

このフックの中核となる関数です。`useCallback` でメモ化されています。

#### a. データ取得 (Promise.all)

-   `supabase.from('...').select('*')` を使い、以下の4つのテーブルから全データを取得します。
    -   `Projects`: `order` で昇順ソート
    -   `ProjectTasks`: `order` で昇順ソート
    -   `Workers`: `order` で昇順ソート
    -   `Assignments`
-   取得処理は `Promise.all` を使って並列実行され、効率化が図られています。
-   いずれかのデータ取得でエラーが発生した場合は、エラーをスローして後続の処理を中断します。

#### b. リソースの構築 (`allResources`)

-   カレンダーの左側に表示される行（リソース）のデータを作成します。
-   **`projectResources`**: `projectsData` を元に、案件のリソースを作成します。
    -   `id`: `proj_` プレフィックス + 案件ID (例: `proj_1`)
    -   `group`: `'projects'`
    -   `title`: 案件名
-   **`taskResources`**: `tasksData` を元に、作業項目のリソースを作成します。
    -   `id`: `task_` プレフィックス + タスクID (例: `task_1`)
    -   `parentId`: 親となる案件のID (`proj_1` など) を指定し、親子関係を定義します。
    -   `group`: `'projects'`
    -   `title`: タスク名
-   **`workerResources`**: `workersData` を元に、作業員のリソースを作成します。
    -   `id`: `work_` プレフィックス + 作業員ID (例: `work_5`)
    -   `group`: `'workers'`
    -   `title`: 作業員名
-   最後に、これらのリソースを結合し、`setResources` でstateを更新します。

#### c. イベントの構築 (`allEvents`)

-   カレンダーの右側に表示されるバー（イベント）のデータを作成します。
-   **`taskEvents`**: `tasksData` を元に、各作業項目の期間を示すイベントを作成します。
    -   `id`: `task-bar_` プレフィックス + タスクID (例: `task-bar_1`)
    -   `resourceId`: イベントがどのリソース（行）に紐付くかを示します。ここではタスク自身のID (`task_1` など) を指定します。
    -   `title`: バーに表示されるタスク名。
    -   `start`, `end`: イベントの開始日と終了日。
    -   `editable: true`: ドラッグ＆ドロップによる変更を許可します。
    -   **デバッグコード:** `console.log('task.name:', task.name);` が挿入されており、各タスクの名前をコンソールに出力します。
-   **`assignmentEvents`**: `assignmentsData` を元に、作業員がどの案件にいつ割り当てられているかを示すイベントを作成します。
    -   `id`: `assign_` プレフィックス + 割り当てID
    -   `resourceId`: 作業員のID (`work_5` など) を指定します。
    -   `title`: 対応する案件名を表示します。
    -   `start`: 割り当て日。
-   最後に、これらのイベントを結合し、`setEvents` でstateを更新します。

### 2. `useEffect`

-   コンポーネントがマウントされた時に、一度だけ `fetchData` 関数を呼び出すためのフックです。

### 3. 戻り値

-   このフックは、以下の4つの値をオブジェクトとして返します。
    -   `resources`: 整形済みのリソースデータ
    -   `events`: 整形済みのイベントデータ
    -   `setEvents`: イベントデータを外部から更新するためのセッター関数
    -   `loading`: データ取得中かどうかを示す真偽値
    -   `error`: データ取得中に発生したエラーメッセージ
    -   `fetchData`: データを再取得するための関数