
function SidebarController_boot(){
  return {
    students: CaseloadService.listStudents(),
    activities: SettingsService.listActivities()
  };
}
function SidebarController_save(payload){
  const user = Session.getActiveUser().getEmail();
  return WorklogService.saveEntry(payload, user);
}
