import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
// import ProjectDetailPage from './pages/ProjectDetailPage' // ★★もう使わないので削除★★
import OverallSchedulePageNew from './pages/OverallSchedulePageNew'
// FullCalendarの基本的なスタイル
// FullCalendar v6とViteの組み合わせでは、パッケージの`exports`設定によりCSSのパス解決に問題が生じることがあります。
// そのため、各プラグインのCSSファイルを直接`dist`フォルダからインポートします。

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/schedule" element={<OverallSchedulePageNew />} /> 
        <Route path="/projects" element={<ProjectsPage />} />
        {/* <Route path="/projects/:id" element={<ProjectDetailPage />} /> */} {/* ★★もう使わないので削除（またはコメントアウト）★★ */}
      </Routes>
    </Layout>
  )
}

export default App
