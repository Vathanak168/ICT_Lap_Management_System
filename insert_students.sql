-- 1. Insert the combined class 8A1 & 8A2
INSERT INTO classes (id, name, shift, academic_year, notes, linked_class_ids)
VALUES ('8A1_8A2_Morning', '8A1 & 8A2', 'Morning', '2025-2026', 'Combined class', '[]')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert the 42 students
INSERT INTO students (student_id, name, english_name, gender, class, shift, status) VALUES
  ('STU-8A-001', 'ផល្លា ឈុនឃាង', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-002', 'ញ៉ឹក រដ្ឋា', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-003', 'ធារី សិរីល័ក្ខ', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-004', 'ហេង លាងម៉េង', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-005', 'ទួន វឌ្ឍនៈ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-006', 'សុគន្ធ ធានី', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-007', 'លន់ ស៊ីឈាងពូ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-008', 'លី ម៉ានី', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-009', 'ស្រេង រ៉ូហ្សា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-010', 'ត្ថា ឬទ្ធី', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-011', 'ឌីណន ខេមរាបុត្រ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-012', 'ហ៊ា ភក្តី', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-013', 'ប៊ុនរិទ្ធ សិទ្ធិការ្យ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-014', 'សៅ សាមីរ៉ូណាត', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-015', 'សុខ ចាន់ធា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-016', 'ស្រេង ឆាយលី', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-017', 'ហ៊ាង លាងជី', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-018', 'គៀន បញ្ញាបុត្រ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-019', 'សុខខា ស្រីកា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-020', 'អ៊ាន ច័ន្ទសុវណ្ណារាជ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-021', 'ឯក ប៊ុនយ៉ារិទ្ធ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-022', 'ប៉ាន់ រ៉ាស៊ីណា', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-023', 'សុភ័ណ្ឌ សូឡារ៉ា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-024', 'រិត លីសា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-025', 'ចាន់ជា សុធីស័ក្ត', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-026', 'ជាវ ហាងស្រ៊ុន', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-027', 'ហ៊ឹម ម៉េងគីម', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-028', 'សុគន្ធ វីរៈបុត្រ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-029', 'យ៉ា ច័ន្ទថា', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-030', 'តាំង មង្គលឧត្តម', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-031', 'ស៊ា សុម៉ានី', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-032', 'ខលជា រ៉ូសប៊ី', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-033', 'លីម ស៊ីវវ័យ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-034', 'យឿនសាវ មុនិន្ទ', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-035', 'សុង ដានិច្ច', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-036', 'ធារ៉ា មុន្នីមករា', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-037', 'ឌី បញ្ញាសិទ្ធ', '', 'M', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-038', 'ឃឹម គីមហេង', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-039', 'ធឿន លីអ៊ឹង', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-040', 'ជាវ គីមជូ', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active'),
  ('STU-8A-041', 'ទូច ម៉ីឡាក់', '', 'F', '8A1_8A2_Morning', 'Morning', 'Active')
ON CONFLICT (student_id) DO NOTHING;
