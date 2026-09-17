import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/800.css'
import '../src/admin/index.css'
import SuperAdminApp from './superadmin/SuperAdminApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SuperAdminApp />
  </React.StrictMode>
)
