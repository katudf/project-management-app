import { useState, useCallback } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import ProjectsForm from '../components/forms/ProjectsForm';
import CustomersForm from '../components/forms/CustomersForm';
import DailyReportsForm from '../components/forms/DailyReportsForm';
import MaterialUsageLogsForm from '../components/forms/MaterialUsageLogsForm';
import MaterialsForm from '../components/forms/MaterialsForm';
import ProjectTasksForm from '../components/forms/ProjectTasksForm';
import ServiceMasterForm from '../components/forms/ServiceMasterForm';
import WorkersForm from '../components/forms/WorkersForm';
import WorkLogsForm from '../components/forms/WorkLogsForm';
import WorkerCertificationsForm from '../components/forms/WorkerCertificationsForm';
import CompanyHolidaysForm from '../components/forms/CompanyHolidaysForm';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export default function DashboardPage() {
  const [value, setValue] = useState(0);
  const [companyHolidaysFormOpen, setCompanyHolidaysFormOpen] = useState(false);

  const handleChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        )}
      </div>
    );
  }

  const a11yProps = useCallback((index: number) => ({
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  }), []);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example" variant="scrollable" scrollButtons="auto">
          <Tab label="Projects" {...a11yProps(0)} />
          <Tab label="Customers" {...a11yProps(1)} />
          <Tab label="DailyReports" {...a11yProps(2)} />
          <Tab label="MaterialUsageLogs" {...a11yProps(3)} />
          <Tab label="Materials" {...a11yProps(4)} />
          <Tab label="ProjectTasks" {...a11yProps(5)} />
          <Tab label="ServiceMaster" {...a11yProps(6)} />
          <Tab label="Workers" {...a11yProps(7)} />
          <Tab label="WorkLogs" {...a11yProps(8)} />
          <Tab label="WorkerCertifications" {...a11yProps(9)} />
          <Tab label="CompanyHolidays" {...a11yProps(10)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        <ProjectsForm />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <CustomersForm />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <DailyReportsForm />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <MaterialUsageLogsForm />
      </TabPanel>
      <TabPanel value={value} index={4}>
        <MaterialsForm />
      </TabPanel>
      <TabPanel value={value} index={5}>
        <ProjectTasksForm />
      </TabPanel>
      <TabPanel value={value} index={6}>
        <ServiceMasterForm />
      </TabPanel>
      <TabPanel value={value} index={7}>
        <WorkersForm />
      </TabPanel>
      <TabPanel value={value} index={8}>
        <WorkLogsForm />
      </TabPanel>
      <TabPanel value={value} index={9}>
        <WorkerCertificationsForm />
      </TabPanel>
      <TabPanel value={value} index={10}>
        <CompanyHolidaysForm />
      </TabPanel>

      <Dialog open={companyHolidaysFormOpen} onClose={() => setCompanyHolidaysFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>会社の休業日設定</DialogTitle>
        <DialogContent>
          <CompanyHolidaysForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompanyHolidaysFormOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

