// Validation layer will handle defining schemas, 
// parsing the payload, 
// and passing the data.

import z from 'zod';
import { subYears, isBefore, isEqual } from 'date-fns';
import { BadRequestError } from '@/shared/error';

const createUserSchema = z.object({ 
    firstName: z
        .string()
        .min(2, "First name must be at least two characters long.")
        .max(50, "First name must be 50 characters long at most."),
    lastName: z
        .string()
        .min(2, "Last name must be at least two characters long.")
        .max(50, "Last name must be 50 characters long at most."),
    email: z
        .email("Please enter a valid email."),
    phone: z
        .string("Please enter a valid phone number.")
        .regex(/^\d{4}-\d{3}-\d{4}$/, "Phone number must be exactly 13 characters long with the specified format."),
    dateOfBirth: z
        .coerce.date()
        .refine(date => {
            const boundary = subYears(date, 18);
            return isBefore(date, boundary) || isEqual(date, boundary);
        })
});

export const validateCreateUserPayload = (payload: z.infer<typeof createUserSchema>) => {
    const parsed = createUserSchema.safeParse(payload);
    if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);
    return parsed.data;
};
