import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials.email as string)?.toLowerCase()?.trim();
        const password = credentials.password as string;
        if (!email || !password) return null;
        const user = await db.select().from(users).where(eq(users.email, email)).then(res => res[0]);
        if (!user || !user.password) return null;
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role as string | undefined;
        token.id = user.id;
      } else if (token.email) {
        // refresh role from DB on each request
        const dbUser = await db.select({ role: users.role, id: users.id }).from(users).where(eq(users.email, token.email as string)).then(r => r[0]);
        if (dbUser) {
          token.role = dbUser.role as string | undefined;
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
