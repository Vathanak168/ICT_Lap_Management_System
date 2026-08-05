-- 1. Delete the wrong combined class and its students
DELETE FROM students WHERE class = '8A1_8A2_Morning';
DELETE FROM classes WHERE id = '8A1_8A2_Morning';

-- 2. Create the two separate classes
INSERT INTO classes (id, name, shift, academic_year, notes, linked_class_ids) VALUES 
('8A1_Morning', '8A1', 'Morning', '2025-2026', 'Graded together with 8A2', '["8A2_Morning"]'),
('8A2_Morning', '8A2', 'Morning', '2025-2026', 'Graded together with 8A1', '["8A1_Morning"]')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert the 25 students for 8A1 (From Page 1)
INSERT INTO students (student_id, name, english_name, gender, class, shift, status) VALUES
  ('STU-8A1-001', 'ផល្លា ឈុនឃាង', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-002', 'ញ៉ឹក រដ្ឋា', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-003', 'ធារី សិរីល័ក្ខ', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-004', 'ហេង លាងម៉េង', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-005', 'ទួន វឌ្ឍនៈ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-006', 'សុគន្ធ ធានី', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-007', 'លន់ ស៊ីឈាងពូ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-008', 'លី ម៉ានី', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-009', 'ស្រេង រ៉ូហ្សា', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-010', 'ត្ថា ឬទ្ធី', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-011', 'ឌីណន ខេមរាបុត្រ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-012', 'ហ៊ា ភក្តី', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-013', 'ប៊ុនរិទ្ធ សិទ្ធិការ្យ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-014', 'សៅ សាមីរ៉ូណាត', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-015', 'សុខ ចាន់ធា', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-016', 'ស្រេង ឆាយលី', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-017', 'ហ៊ាង លាងជី', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-018', 'គៀន បញ្ញាបុត្រ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-019', 'សុខខា ស្រីកា', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-020', 'អ៊ាន ច័ន្ទសុវណ្ណារាជ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-021', 'ឯក ប៊ុនយ៉ារិទ្ធ', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-022', 'ប៉ាន់ រ៉ាស៊ីណា', '', 'M', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-023', 'សុភ័ណ្ឌ សូឡារ៉ា', '', 'F', '8A1_Morning', 'Morning', 'Active'),
  ('STU-8A1-024', 'រិត លីសា', '', 'F', '8A1_Morning', 'Morning', 'Active')
ON CONFLICT (student_id) DO NOTHING;

-- 4. Insert the 17 students for 8A2 (From Page 2)
INSERT INTO students (student_id, name, english_name, gender, class, shift, status) VALUES
  ('STU-8A2-001', 'ចាន់ជា សុធីស័ក្ត', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-002', 'ជាវ ហាងស្រ៊ុន', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-003', 'ហ៊ឹម ម៉េងគីម', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-004', 'សុគន្ធ វីរៈបុត្រ', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-005', 'យ៉ា ច័ន្ទថា', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-006', 'តាំង មង្គលឧត្តម', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-007', 'ស៊ា សុម៉ានី', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-008', 'ខលជា រ៉ូសប៊ី', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-009', 'លីម ស៊ីវវ័យ', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-010', 'យឿនសាវ មុនិន្ទ', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-011', 'សុង ដានិច្ច', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-012', 'ធារ៉ា មុន្នីមករា', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-013', 'ឌី បញ្ញាសិទ្ធ', '', 'M', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-014', 'ឃឹម គីមហេង', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-015', 'ធឿន លីអ៊ឹង', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-016', 'ជាវ គីមជូ', '', 'F', '8A2_Morning', 'Morning', 'Active'),
  ('STU-8A2-017', 'ទូច ម៉ីឡាក់', '', 'F', '8A2_Morning', 'Morning', 'Active')
ON CONFLICT (student_id) DO NOTHING;
