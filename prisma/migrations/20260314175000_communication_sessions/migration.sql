CREATE TYPE "CommunicationChannel" AS ENUM ('CALL', 'MESSAGE');

CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

ALTER TABLE "ActivityReport"
ADD COLUMN "communicationSessionId" TEXT,
ADD COLUMN "durationSeconds" INTEGER;

CREATE TABLE "CommunicationSession" (
    "id" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "phoneNumber" TEXT,
    "messageBody" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityReport_communicationSessionId_key" ON "ActivityReport"("communicationSessionId");

ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationSession" ADD CONSTRAINT "CommunicationSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_communicationSessionId_fkey" FOREIGN KEY ("communicationSessionId") REFERENCES "CommunicationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
