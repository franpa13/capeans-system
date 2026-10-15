import { describe, expect, it } from "vitest";
import { reminderMessage, toWhatsAppNumber, whatsAppLink } from "@/features/appointments/lib/reminder";

describe("toWhatsAppNumber", () => {
  it("turns a local Argentine mobile into the international WhatsApp format", () => {
    expect(toWhatsAppNumber("11 3333-4444")).toBe("5491133334444");
    expect(toWhatsAppNumber("(0351) 555-1234")).toBe("5493515551234");
  });

  it("drops the 15 mobile prefix after the area code", () => {
    expect(toWhatsAppNumber("011 15 3333-4444")).toBe("5491133334444");
    expect(toWhatsAppNumber("351 15 555-1234")).toBe("5493515551234");
  });

  it("accepts numbers already written with the country code", () => {
    expect(toWhatsAppNumber("+54 9 11 3333-4444")).toBe("5491133334444");
    expect(toWhatsAppNumber("+54 11 3333-4444")).toBe("5491133334444");
  });

  it("returns null when the number is too short to be a full one", () => {
    expect(toWhatsAppNumber("4444-5555")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
  });
});

describe("reminderMessage", () => {
  const now = new Date(2026, 9, 15, 9, 0); // Thu 15/10/2026 09:00

  it("says 'mañana' for a turno the next day, with the time and the clinic", () => {
    expect(
      reminderMessage({
        patientName: "María Gómez",
        startsAt: new Date(2026, 9, 16, 10, 30),
        clinicName: "Consultorio Capeans",
        now,
      }),
    ).toBe(
      "Hola María, te recordamos tu turno mañana a las 10:30 en Consultorio Capeans. Si no podés venir, por favor avisanos por acá. ¡Gracias!",
    );
  });

  it("says 'hoy' for a turno the same day", () => {
    expect(
      reminderMessage({
        patientName: "Juan",
        startsAt: new Date(2026, 9, 15, 17, 0),
        clinicName: "Consultorio",
        now,
      }),
    ).toContain("tu turno hoy a las 17:00");
  });

  it("names the weekday and date for a turno further ahead", () => {
    expect(
      reminderMessage({
        patientName: "Juan",
        startsAt: new Date(2026, 9, 20, 9, 0),
        clinicName: "Consultorio",
        now,
      }),
    ).toContain("tu turno el martes 20/10 a las 09:00");
  });
});

describe("whatsAppLink", () => {
  it("opens a chat with the number and the message already written", () => {
    expect(whatsAppLink("5491133334444", "Hola María, ¿todo bien?")).toBe(
      "https://wa.me/5491133334444?text=Hola%20Mar%C3%ADa%2C%20%C2%BFtodo%20bien%3F",
    );
  });
});
