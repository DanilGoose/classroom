import axios from './axios';
import type {
  AuthResponse,
  LoginData,
  RegisterData,
  Course,
  CreateCourseData,
  UpdateCourseData,
  JoinCourseData,
  Assignment,
  CreateAssignmentData,
  UpdateAssignmentData,
  Message,
  CreateMessageData,
  CourseMember,
  User,
  Submission,
  CreateSubmissionData,
  GradeSubmissionData,
} from '../types';

// Auth
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await axios.post('/auth/login', data);
  return response.data;
};

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await axios.post('/auth/register', data);
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await axios.get('/auth/me');
  return response.data;
};

export const updateProfile = async (data: { email?: string; username?: string }): Promise<User> => {
  const response = await axios.put('/auth/profile', data);
  return response.data;
};

export const updatePassword = async (data: { old_password: string; new_password: string }): Promise<{ message: string }> => {
  const response = await axios.put('/auth/password', data);
  return response.data;
};

// Courses
export const getCourses = async (archived?: boolean): Promise<Course[]> => {
  const params = archived !== undefined ? { archived } : {};
  const response = await axios.get('/courses', { params });
  return response.data;
};

export const getCourse = async (id: number): Promise<Course> => {
  const response = await axios.get(`/courses/${id}`);
  return response.data;
};

export const createCourse = async (data: CreateCourseData): Promise<Course> => {
  const response = await axios.post('/courses', data);
  return response.data;
};

export const joinCourse = async (data: JoinCourseData): Promise<Course> => {
  const response = await axios.post('/courses/join', data);
  return response.data;
};

export const getCourseMembers = async (courseId: number): Promise<CourseMember[]> => {
  const response = await axios.get(`/courses/${courseId}/members`);
  return response.data;
};

export const removeMember = async (courseId: number, userId: number): Promise<void> => {
  await axios.delete(`/courses/${courseId}/members/${userId}`);
};

export const updateCourse = async (courseId: number, data: UpdateCourseData): Promise<Course> => {
  const response = await axios.put(`/courses/${courseId}`, data);
  return response.data;
};

export const leaveCourse = async (courseId: number): Promise<void> => {
  await axios.post(`/courses/${courseId}/leave`);
};

export const archiveCourse = async (courseId: number): Promise<Course> => {
  const response = await axios.put(`/courses/${courseId}/archive`);
  return response.data;
};

// Assignments
export const getAssignments = async (courseId: number): Promise<Assignment[]> => {
  const response = await axios.get(`/assignments/courses/${courseId}/assignments`);
  return response.data;
};

export const getMyAssignments = async (): Promise<any[]> => {
  const response = await axios.get('/assignments/my-assignments');
  return response.data;
};

export const getAssignment = async (id: number): Promise<Assignment> => {
  const response = await axios.get(`/assignments/${id}`);
  return response.data;
};

export const createAssignment = async (
  courseId: number,
  data: CreateAssignmentData
): Promise<Assignment> => {
  const response = await axios.post(`/assignments/courses/${courseId}/assignments`, data);
  return response.data;
};

export const uploadFile = async (assignmentId: number, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('file', file);
  await axios.post(`/assignments/${assignmentId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteFile = async (assignmentId: number, fileId: number): Promise<void> => {
  await axios.delete(`/assignments/${assignmentId}/files/${fileId}`);
};

export const updateAssignment = async (
  assignmentId: number,
  data: UpdateAssignmentData
): Promise<Assignment> => {
  const response = await axios.put(`/assignments/${assignmentId}`, data);
  return response.data;
};

export const deleteAssignment = async (assignmentId: number): Promise<void> => {
  await axios.delete(`/assignments/${assignmentId}`);
};

export const markAssignmentAsRead = async (assignmentId: number): Promise<void> => {
  await axios.post(`/assignments/${assignmentId}/mark-read`);
};

export const getAssignmentUngradedSubmissions = async (assignmentId: number): Promise<Submission[]> => {
  const response = await axios.get(`/assignments/${assignmentId}/ungraded-submissions`);
  return response.data;
};

// Chat
export const getMessages = async (
  assignmentId: number,
  offset: number = 0,
  limit: number = 10
): Promise<Message[]> => {
  const response = await axios.get(`/chat/assignments/${assignmentId}/messages`, {
    params: { offset, limit },
  });
  return response.data;
};

export const sendMessage = async (
  assignmentId: number,
  data: CreateMessageData
): Promise<Message> => {
  const response = await axios.post(`/chat/assignments/${assignmentId}/messages`, data);
  return response.data;
};

export const deleteMessage = async (messageId: number): Promise<void> => {
  await axios.delete(`/chat/messages/${messageId}`);
};

// Submissions
export const submitAssignment = async (
  assignmentId: number,
  data: CreateSubmissionData
): Promise<Submission> => {
  const response = await axios.post(`/submissions/assignments/${assignmentId}/submit`, data);
  return response.data;
};

export const getMySubmission = async (assignmentId: number): Promise<Submission[]> => {
  const response = await axios.get(`/submissions/assignments/${assignmentId}/my-submission`);
  return response.data;
};

export const getAssignmentSubmissions = async (assignmentId: number): Promise<Submission[]> => {
  const response = await axios.get(`/submissions/assignments/${assignmentId}/submissions`);
  return response.data;
};

export const getSubmission = async (submissionId: number): Promise<Submission> => {
  const response = await axios.get(`/submissions/${submissionId}`);
  return response.data;
};

export const gradeSubmission = async (
  submissionId: number,
  data: GradeSubmissionData
): Promise<Submission> => {
  const response = await axios.put(`/submissions/${submissionId}/grade`, data);
  return response.data;
};

export const uploadSubmissionFile = async (submissionId: number, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append('file', file);
  await axios.post(`/submissions/${submissionId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteSubmissionFile = async (
  submissionId: number,
  fileId: number
): Promise<void> => {
  await axios.delete(`/submissions/${submissionId}/files/${fileId}`);
};

export const deleteSubmission = async (submissionId: number): Promise<void> => {
  await axios.delete(`/submissions/${submissionId}`);
};

export const markSubmissionViewed = async (submissionId: number): Promise<Submission> => {
  const response = await axios.post(`/submissions/${submissionId}/mark-viewed`);
  return response.data;
};

export const getMyAttemptsInfo = async (assignmentId: number): Promise<{ total_attempts: number; max_attempts: number | null }> => {
  const response = await axios.get(`/submissions/assignments/${assignmentId}/attempts-info`);
  return response.data;
};

// Admin
export const getAllUsers = async (): Promise<User[]> => {
  const response = await axios.get('/admin/users');
  return response.data;
};

export const deleteUser = async (userId: number): Promise<void> => {
  await axios.delete(`/admin/users/${userId}`);
};

export const getAllCourses = async (): Promise<Course[]> => {
  const response = await axios.get('/admin/courses');
  return response.data;
};

export const deleteCourse = async (courseId: number): Promise<void> => {
  await axios.delete(`/admin/courses/${courseId}`);
};

export const getCourseGradebook = async (courseId: number): Promise<any> => {
  const response = await axios.get(`/courses/${courseId}/gradebook`);
  return response.data;
};

export const getCourseUngradedSubmissions = async (courseId: number): Promise<any[]> => {
  const response = await axios.get(`/courses/${courseId}/ungraded-submissions`);
  return response.data;
};
