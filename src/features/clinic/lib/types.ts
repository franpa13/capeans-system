export type Patient = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  dni?: string;
  birthDate?: string;
  address?: string;
  insurance?: string;
  allergies?: string;
};

export type NewPatientInput = Omit<Patient, "id">;

export type Consultation = {
  id: string;
  patientId: string;
  date: string;
  treatment: string;
  tooth?: string;
  notes?: string;
};

export type NewConsultationInput = Omit<Consultation, "id">;
