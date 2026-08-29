-- SQL Script to clean up orphaned students
-- នេះជាកូដសម្រាប់លុបសិស្សដែលគ្មានថ្នាក់ (សិស្សដែលមានថ្នាក់ចាស់ ហើយថ្នាក់នោះត្រូវបានលុបចោល)

DELETE FROM students
WHERE class NOT IN (SELECT name FROM classes);
