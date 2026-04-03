/**
 * Enrollments routes.
 *
 * Access model:
 * - Student can create/join/enumerate only their own enrollments.
 * - Teacher can only see enrollments for classes they teach.
 * - Admin can see everything.
 */
import express from "express";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { classes, departments, enrollments, subjects, user } from "../db/schema/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const getEnrollmentDetails = async (enrollmentId: number) => {
  // Centralized join to return enrollment + related class/subject/teacher.
  const [enrollment] = await db
    .select({
      ...getTableColumns(enrollments),
      class: {
        ...getTableColumns(classes),
      },
      subject: {
        ...getTableColumns(subjects),
      },
      department: {
        ...getTableColumns(departments),
      },
      teacher: {
        ...getTableColumns(user),
      },
    })
    .from(enrollments)
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(departments, eq(subjects.departmentId, departments.id))
    .leftJoin(user, eq(classes.teacherId, user.id))
    .where(eq(enrollments.id, enrollmentId));

  return enrollment;
};

// Get enrollments (Refine `list` expects GET support).
// Access rules:
// - student: only their enrollments
// - teacher: only enrollments for classes they teach
// - admin: all enrollments
router.get("/", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);
    const offset = (currentPage - 1) * limitPerPage;

    const role = req.user!.role;
    let whereClause = undefined;
    if (role === "student") {
      whereClause = eq(enrollments.studentId, req.user!.id);
    } else if (role === "teacher") {
      whereClause = eq(classes.teacherId, req.user!.id);
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .leftJoin(classes, eq(enrollments.classId, classes.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const enrollmentsList = await db
      .select({
        ...getTableColumns(enrollments),
        class: {
          ...getTableColumns(classes),
        },
        subject: {
          ...getTableColumns(subjects),
        },
        department: {
          ...getTableColumns(departments),
        },
        teacher: {
          ...getTableColumns(user),
        },
      })
      .from(enrollments)
      .leftJoin(classes, eq(enrollments.classId, classes.id))
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(enrollments.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: enrollmentsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /enrollments error:", error);
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const enrollmentId = Number(req.params.id);

    if (!Number.isFinite(enrollmentId)) {
      return res.status(400).json({ error: "Invalid enrollment id" });
    }

    const enrollment = await getEnrollmentDetails(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    if (req.user!.role === "student" && enrollment.studentId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (
      req.user!.role === "teacher" &&
      enrollment.class?.teacherId !== req.user!.id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.status(200).json({ data: enrollment });
  } catch (error) {
    console.error("GET /enrollments/:id error:", error);
    res.status(500).json({ error: "Failed to fetch enrollment details" });
  }
});

// Create enrollment
router.post("/", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    if (!classId || !studentId) {
      return res
        .status(400)
        .json({ error: "classId and studentId are required" });
    }

    if (req.user!.id !== studentId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [classRecord] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));

    if (!classRecord) return res.status(404).json({ error: "Class not found" });

    const [student] = await db
      .select()
      .from(user)
      .where(eq(user.id, studentId));

    if (!student) return res.status(404).json({ error: "Student not found" });

    const [existingEnrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classId, classId),
          eq(enrollments.studentId, studentId)
        )
      );

    if (existingEnrollment)
      return res
        .status(409)
        .json({ error: "Student already enrolled in class" });

    const [createdEnrollment] = await db
      .insert(enrollments)
      .values({ classId, studentId })
      .returning({ id: enrollments.id });

    if (!createdEnrollment)
      return res.status(500).json({ error: "Failed to create enrollment" });

    const enrollment = await getEnrollmentDetails(createdEnrollment.id);

    res.status(201).json({ data: enrollment });
  } catch (error) {
    console.error("POST /enrollments error:", error);
    res.status(500).json({ error: "Failed to create enrollment" });
  }
});

// Join class by invite code
router.post(
  "/join",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
  try {
    const { inviteCode, studentId } = req.body;

    if (!inviteCode || !studentId) {
      return res
        .status(400)
        .json({ error: "inviteCode and studentId are required" });
    }

    if (req.user!.id !== studentId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [classRecord] = await db
      .select()
      .from(classes)
      .where(eq(classes.inviteCode, inviteCode));

    if (!classRecord) return res.status(404).json({ error: "Class not found" });

    const [student] = await db
      .select()
      .from(user)
      .where(eq(user.id, studentId));

    if (!student) return res.status(404).json({ error: "Student not found" });

    const [existingEnrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classId, classRecord.id),
          eq(enrollments.studentId, studentId)
        )
      );

    if (existingEnrollment)
      return res
        .status(409)
        .json({ error: "Student already enrolled in class" });

    const [createdEnrollment] = await db
      .insert(enrollments)
      .values({ classId: classRecord.id, studentId })
      .returning({ id: enrollments.id });

    if (!createdEnrollment)
      return res.status(500).json({ error: "Failed to join class" });

    const enrollment = await getEnrollmentDetails(createdEnrollment.id);

    res.status(201).json({ data: enrollment });
  } catch (error) {
    console.error("POST /enrollments/join error:", error);
    res.status(500).json({ error: "Failed to join class" });
  }
}
);

export default router;
