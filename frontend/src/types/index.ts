export interface User {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Course {
  id: number;
  title: string;
  description: string | null;
  code: string;
  creator_id: number;
  created_at: string;
  is_archived: number;
  is_creator: boolean;
  member_count: number;
}

export interface CourseMember {
  id: number;
  user_id: number;
  username: string;
  email: string;
  joined_at: string;
}

export interface Assignment {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  created_by: number;
  created_at: string;
  due_date: string | null;
  grading_type: 'numeric' | 'text';
  grade_min: number | null;
  grade_max: number | null;
  grade_options: string | null; // JSON string
  max_attempts: number | null; // null = неограниченно
  files: AssignmentFile[];
  is_read?: boolean; // Просмотрено ли задание студентом
}

export interface AssignmentFile {
  id: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export interface Message {
  id: number;
  assignment_id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
  is_deleted: boolean;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  content: string | null;
  score: number | string | null;
  teacher_comment: string | null;
  submitted_at: string;
  graded_at: string | null;
  viewed_by_teacher: number; // 0 = не просмотрено, 1 = просмотрено
  files: SubmissionFile[];
  student_name: string | null;
}

export interface SubmissionFile {
  id: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export interface CreateCourseData {
  title: string;
  description?: string;
}

export interface JoinCourseData {
  code: string;
}

export interface CreateAssignmentData {
  title: string;
  description?: string;
  due_date?: string;
  grading_type?: 'numeric' | 'text';
  grade_min?: number;
  grade_max?: number;
  grade_options?: string[];
  max_attempts?: number | null;
}

export interface UpdateAssignmentData {
  title?: string;
  description?: string;
  due_date?: string;
  grading_type?: 'numeric' | 'text';
  grade_min?: number;
  grade_max?: number;
  grade_options?: string[];
  max_attempts?: number | null;
}

export interface UpdateCourseData {
  title?: string;
  description?: string;
}

export interface CreateSubmissionData {
  content?: string;
}

export interface GradeSubmissionData {
  score: number | string;
  teacher_comment?: string;
}

export interface CreateMessageData {
  message: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AdminSubmission {
  id: number;
  assignment_id: number;
  assignment_title: string | null;
  course_id: number | null;
  student_id: number;
  student_name: string | null;
  content: string | null;
  score: number | string | null;
  teacher_comment: string | null;
  submitted_at: string;
  graded_at: string | null;
  viewed_by_teacher: number;
  files: SubmissionFile[];
}
