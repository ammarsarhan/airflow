// Handles recieving the parsed data from the validation layer through the controller, 
// handling database read and write actions,
// caching the data as required,
// and returning the required data.

import { InternalServerError } from "@/shared/error";
import prisma from "@/shared/prisma";

export default class AuthService {
    signUpUserWithCredentials = async (data: any) => {
        const user = await prisma.user.create({ data });
        if (!user) throw new InternalServerError("An internal error has occurred while creating a new user account.");
        return user;
    };
};