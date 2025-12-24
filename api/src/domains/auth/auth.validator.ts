// Validation layer will handle defining schemas, 
// parsing the payload, 
// and passing the data.

import z from 'zod';
import { subYears, isBefore, isEqual } from 'date-fns';
import { BadRequestError } from '@/shared/error';

const signUpSchema = z.object({ 
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
    password: z
        .string("Please enter a valid password.")
        .min(8, "Password must be at least 8 characters long.")
        .max(50, "Password must be less than 50 characters long.")
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
        .regex(/[0-9]/, 'Password must contain at least one number.'),
    dateOfBirth: z
        .coerce.date()
        .refine(date => {
            const boundary = subYears(date, 18);
            return isBefore(date, boundary) || isEqual(date, boundary);
        }, "You must be at least 18 years old to sign up.")
});

export const validateSignUpPayload = (payload: z.infer<typeof signUpSchema>) => {
    const parsed = signUpSchema.safeParse(payload);
    if (!parsed.success) throw new BadRequestError(parsed.error.issues[0].message);
    return parsed.data;
};
