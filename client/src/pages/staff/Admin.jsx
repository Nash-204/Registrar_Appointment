import { useCallback, useEffect, useState } from 'react';
import Shell from './Shell.jsx';
import { api } from '../../api.js';
import { AppointmentsPanel, ChatsPanel, OverviewPanel } from './panels.jsx';
import { WorkloadPanel } from './workload.jsx';
import { CapacityPanel, WalkInPanel } from './walkins.jsx';
import { EmployeesPanel, ServicesPanel, SettingsPanel } from './manage.jsx';
import { ChatbotPanel } from './chatbot.jsx';

const TABS = [
  ['overview', 'Overview'], ['appts', 'Appointments'], ['work', 'Workload'], ['capacity', 'Capacity'], ['walkin', 'Walk-ins'],
  ['chats', 'Chats'], ['chatbot', 'Chatbot'], ['employees', 'Employees'], ['services', 'Services and documents'], ['settings', 'Settings'],
];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const reload = useCallback(() => api('/employees').then(setEmployees).catch(() => {}), []);
  useEffect(() => { reload(); }, [reload]);
  return (
    <Shell title="Admin panel" tabs={TABS} tab={tab} setTab={(t) => { setTab(t); reload(); }}>
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'appts' && <AppointmentsPanel admin employees={employees} />}
      {tab === 'work' && <WorkloadPanel admin />}
      {tab === 'capacity' && <CapacityPanel />}
      {tab === 'walkin' && <WalkInPanel admin employees={employees} />}
      {tab === 'chats' && <ChatsPanel admin employees={employees} />}
      {tab === 'chatbot' && <ChatbotPanel />}
      {tab === 'employees' && <EmployeesPanel employees={employees} reload={reload} />}
      {tab === 'services' && <ServicesPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </Shell>
  );
}
