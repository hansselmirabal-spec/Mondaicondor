-- Board.workspaceId
CREATE INDEX IF NOT EXISTS "Board_workspaceId_idx" ON "Board"("workspaceId");

-- Group.boardId
CREATE INDEX IF NOT EXISTS "Group_boardId_idx" ON "Group"("boardId");

-- Task.groupId, status, deadline
CREATE INDEX IF NOT EXISTS "Task_groupId_idx" ON "Task"("groupId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_deadline_idx" ON "Task"("deadline");

-- Comment.taskId
CREATE INDEX IF NOT EXISTS "Comment_taskId_idx" ON "Comment"("taskId");

-- Activity.taskId, userId
CREATE INDEX IF NOT EXISTS "Activity_taskId_idx" ON "Activity"("taskId");
CREATE INDEX IF NOT EXISTS "Activity_userId_idx" ON "Activity"("userId");

-- Automation.boardId, enabled
CREATE INDEX IF NOT EXISTS "Automation_boardId_idx" ON "Automation"("boardId");
CREATE INDEX IF NOT EXISTS "Automation_enabled_idx" ON "Automation"("enabled");

-- Notification.userId, read
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON "Notification"("read");

-- RefreshToken.userId
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- WorkspaceMember.userId
CREATE INDEX IF NOT EXISTS "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
