import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '../store'
import { useAdminListeners } from '../hooks/useAdminListeners'
import TopBar from '../components/TopBar'
import AdminSidebar from '../components/AdminSidebar'
import AdminBottomNav from '../components/AdminBottomNav'
import SessionsTab from '../tabs/SessionsTab'
import MenuTab from '../tabs/MenuTab'
import StaffTab from '../tabs/StaffTab'
import AnalyticsTab from '../tabs/AnalyticsTab'
import TablesTab from '../tabs/TablesTab'
import CallsTab from '../tabs/CallsTab'
import DeliveryTab from '../tabs/DeliveryTab'
import ScheduleTab from '../tabs/ScheduleTab'
import ChatTab from '../tabs/ChatTab'
import ProfileModal from '../components/ProfileModal'
import MobileMenuDrawer from '../components/MobileMenuDrawer'
import NewOrderModal from '../modals/NewOrderModal'
import AddStaffModal from '../modals/AddStaffModal'
import AssignTablesModal from '../modals/AssignTablesModal'
import SessionDetailModal from '../modals/SessionDetailModal'
import ShiftModal from '../modals/ShiftModal'
import TableQRModal from '../modals/TableQRModal'

const TAB_MAP: Record<string, React.FC> = {
  sessions:  SessionsTab,
  menu:      MenuTab,
  staff:     StaffTab,
  analytics: AnalyticsTab,
  tables:    TablesTab,
  calls:     CallsTab,
  delivery:  DeliveryTab,
  schedule:  ScheduleTab,
  chat:      ChatTab,
}

export default function AppScreen() {
  const { activeTab, newOrderOpen, addStaffOpen, assignOpen, sessionDetailId, shiftModal, qrTableId } = useAdminStore()

  // Запускаем все listeners данных
  useAdminListeners()

  const TabContent = TAB_MAP[activeTab] ?? SessionsTab

  return (
    <div className="adm-layout min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar — только desktop */}
      <AdminSidebar />

      {/* Main column */}
      <div className="adm-main">
        <TopBar />

        <div className="adm-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <TabContent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom nav — только mobile */}
        <AdminBottomNav />
      </div>

      {/* Modals */}
      {newOrderOpen    && <NewOrderModal />}
      {addStaffOpen    && <AddStaffModal />}
      {assignOpen      && <AssignTablesModal />}
      {sessionDetailId && <SessionDetailModal />}
      {shiftModal.open && <ShiftModal />}
      {qrTableId       && <TableQRModal />}
      <ProfileModal />
      <MobileMenuDrawer />
    </div>
  )
}