import prisma from "@/shared/prisma";
import { InternalServerError } from "@/shared/error";

export class UserService {
    createPassenger = async (data: any) => {
        const passenger = await prisma.passenger.create({ data });
        if (!passenger) throw new InternalServerError("An internal error has occurred while creating a new passenger.");
        return passenger;
    };
}