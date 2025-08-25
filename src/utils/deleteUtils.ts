import { supabase } from '../supabaseClient';

export const deleteProject = async (projectId: number): Promise<void> => {
  // プロジェクトに紐づくタスク取得
  const { data: tasks, error: tasksError } = await supabase
    .from('ProjectTasks')
    .select('id')
    .eq('projectId', projectId);
  if (tasksError) throw new Error(`タスク取得エラー: ${tasksError.message}`);
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length > 0) {
    // Assignments削除
    const { error: assignmentsError } = await supabase
      .from('Assignments')
      .delete()
      .in('projectTaskId', taskIds);
    if (assignmentsError) throw new Error(`Assignments削除エラー: ${assignmentsError.message}`);

    // WorkLogs削除
    const { error: worklogsError } = await supabase
      .from('WorkLogs')
      .delete()
      .in('projectTaskId', taskIds);
    if (worklogsError) throw new Error(`WorkLogs削除エラー: ${worklogsError.message}`);
  }

  // ProjectTasks削除
  const { error: projectTasksError } = await supabase.from('ProjectTasks').delete().match({ projectId });
  if (projectTasksError) throw new Error(`ProjectTasks削除エラー: ${projectTasksError.message}`);

  // Projects削除
  const { error: projectError } = await supabase.from('Projects').delete().match({ id: projectId });
  if (projectError) throw new Error(`Projects削除エラー: ${projectError.message}`);
};