import { supabase } from '../supabaseClient';

export const deleteProject = async (projectId: number) => {
  // Get all project tasks for the project
  const { data: tasks, error: tasksError } = await supabase
    .from('ProjectTasks')
    .select('id')
    .eq('projectId', projectId);

  if (tasksError) {
    throw new Error(`タスクの取得中にエラーが発生しました: ${tasksError.message}`);
  }

  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length > 0) {
    // Delete from Assignments
    const { error: assignmentsError } = await supabase
      .from('Assignments')
      .delete()
      .in('projectTaskId', taskIds);

    if (assignmentsError) {
      throw new Error(`Assignmentsの削除中にエラーが発生しました: ${assignmentsError.message}`);
    }

    // Delete from WorkLogs
    const { error: worklogsError } = await supabase
      .from('WorkLogs')
      .delete()
      .in('projectTaskId', taskIds);

    if (worklogsError) {
      throw new Error(`WorkLogsの削除中にエラーが発生しました: ${worklogsError.message}`);
    }
  }

  // Then, delete from ProjectTasks
  const { error: projectTasksError } = await supabase.from('ProjectTasks').delete().match({ projectId });
  if (projectTasksError) {
    throw new Error(`ProjectTasksの削除中にエラーが発生しました: ${projectTasksError.message}`);
  }

  // Finally, delete the project
  const { error: projectError } = await supabase.from('Projects').delete().match({ id: projectId });
  if (projectError) {
    throw new Error(`プロジェクトの削除中にエラーが発生しました: ${projectError.message}`);
  }
};