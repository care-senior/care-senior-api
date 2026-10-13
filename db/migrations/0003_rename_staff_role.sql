ALTER TABLE staff_members RENAME COLUMN role TO staff_role;

ALTER TYPE staff_role RENAME VALUE 'Coordenadora' TO 'coordinator';
ALTER TYPE staff_role RENAME VALUE 'Enfermeira' TO 'nurse';
ALTER TYPE staff_role RENAME VALUE 'Cuidador' TO 'caregiver';
