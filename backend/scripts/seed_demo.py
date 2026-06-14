"""
Seed (or reset) a public DEMO organization with realistic sample data so
visitors can explore VoxHire without signing up.

Idempotent: re-running wipes the demo org's candidates/jobs/interviews and
reseeds fresh. Run on the server:

    cd backend && source venv/bin/activate && python -m scripts.seed_demo
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, text

from app.db.database import AsyncSessionLocal
from app.core.config import settings
from app.db.models import (
    Organization, User, UserRole, Candidate, JobDescription, CandidateSkill,
    InterviewSession, InterviewStatus, SkillEvaluation, EvaluationRating,
    HiringDecision, SubscriptionPlan, Subscription, SubscriptionStatus,
)
from app.modules.auth.service import hash_password

DEMO_SLUG = "demo"
DEMO_ORG_NAME = "Acme Talent (Demo)"
DEMO_EMAIL = "demo@voxhire.ai"
DEMO_PASSWORD = "ExploreVoxHire1!"

now = datetime.now(timezone.utc)


def profile(name, email, phone, loc, years, role, tech, frameworks, summary):
    return {
        "personal": {"name": name, "email": email, "phone": phone, "location": loc},
        "skills": {"technical": tech, "frameworks": frameworks, "languages": ["English", "Hindi"], "tools": ["Git", "Docker"]},
        "experience": [{"role": role, "company": "Previous Co.", "years": years}],
        "total_experience_years": years,
        "summary": summary,
    }


JOBS = [
    ("Senior Backend Engineer", ["Python", "FastAPI", "PostgreSQL", "System Design", "AWS"]),
    ("Full Stack Developer", ["React", "TypeScript", "Node.js", "PostgreSQL"]),
    ("ML Engineer", ["Python", "PyTorch", "NLP", "MLOps"]),
]

# name, email, role, years, location, rating, tech, frameworks, interview(dict|None)
CANDIDATES = [
    ("Aarav Sharma", "aarav@example.com", "Senior Backend Engineer", 7, "Bengaluru", HiringDecision.STRONG_HIRE,
     ["Python", "FastAPI", "PostgreSQL", "System Design"], ["FastAPI", "Django"],
     dict(type="Technical", diff="Hard", rating=HiringDecision.STRONG_HIRE, comm=92, conf=88, clar=90,
          summary="Exceptional backend depth. Designed scalable systems with clear trade-off reasoning.",
          strengths=["Strong system design", "Deep async Python knowledge", "Clear communication"],
          weak=["Limited frontend exposure"],
          covered=["System Design", "Python", "PostgreSQL"], missing=["Frontend"],
          skills=[("System Design", EvaluationRating.STRONG, 94), ("Python", EvaluationRating.STRONG, 90), ("PostgreSQL", EvaluationRating.STRONG, 88)])),
    ("Priya Patel", "priya@example.com", "Full Stack Developer", 4, "Pune", HiringDecision.HIRE,
     ["React", "TypeScript", "Node.js"], ["React", "Next.js"],
     dict(type="Technical", diff="Medium", rating=HiringDecision.HIRE, comm=85, conf=80, clar=83,
          summary="Solid full-stack skills with good React fundamentals and pragmatic problem solving.",
          strengths=["Strong React/TypeScript", "Good product sense"],
          weak=["DB indexing depth could improve"],
          covered=["React", "TypeScript", "Node.js"], missing=["Advanced SQL"],
          skills=[("React", EvaluationRating.STRONG, 87), ("TypeScript", EvaluationRating.MEDIUM, 78), ("Node.js", EvaluationRating.MEDIUM, 75)])),
    ("Rahul Verma", "rahul@example.com", "Data Engineer", 5, "Hyderabad", HiringDecision.CONSIDER,
     ["Python", "SQL", "Airflow", "Spark"], ["Airflow"],
     dict(type="Technical", diff="Medium", rating=HiringDecision.CONSIDER, comm=74, conf=70, clar=72,
          summary="Competent data engineering background; some gaps in distributed systems reasoning.",
          strengths=["Strong SQL", "ETL pipeline experience"],
          weak=["Distributed systems depth", "Hesitant under follow-ups"],
          covered=["SQL", "Airflow"], missing=["Spark internals", "System Design"],
          skills=[("SQL", EvaluationRating.STRONG, 84), ("Airflow", EvaluationRating.MEDIUM, 72), ("Spark", EvaluationRating.WEAK, 58)])),
    ("Ananya Iyer", "ananya@example.com", "ML Engineer", 3, "Chennai", HiringDecision.REJECT,
     ["Python", "scikit-learn"], ["Flask"],
     dict(type="Technical", diff="Hard", rating=HiringDecision.REJECT, comm=62, conf=55, clar=60,
          summary="Foundational ML knowledge but struggled with production ML and deeper NLP questions.",
          strengths=["Understands core ML concepts"],
          weak=["No MLOps experience", "Shallow NLP depth", "Difficulty with scenario questions"],
          covered=["Python", "ML basics"], missing=["MLOps", "NLP", "PyTorch"],
          skills=[("Python", EvaluationRating.MEDIUM, 70), ("NLP", EvaluationRating.WEAK, 48), ("MLOps", EvaluationRating.WEAK, 42)])),
    ("Sneha Reddy", "sneha@example.com", "Frontend Engineer", 4, "Remote", HiringDecision.PENDING,
     ["React", "CSS", "TypeScript"], ["React", "Tailwind"], None),  # scheduled, not interviewed yet
    ("Karan Mehta", "karan@example.com", "DevOps Engineer", 6, "Gurgaon", HiringDecision.PENDING,
     ["AWS", "Kubernetes", "Terraform"], [], None),  # scheduled
]


async def reset_demo(db, org_id: str):
    stmts = [
        "DELETE FROM skill_evaluations WHERE session_id IN (SELECT id FROM interview_sessions WHERE org_id=:o)",
        "DELETE FROM transcript_entries WHERE session_id IN (SELECT id FROM interview_sessions WHERE org_id=:o)",
        "DELETE FROM anti_cheat_violations WHERE session_id IN (SELECT id FROM interview_sessions WHERE org_id=:o)",
        "DELETE FROM interview_sessions WHERE org_id=:o",
        "DELETE FROM candidate_jobs WHERE candidate_id IN (SELECT id FROM candidates WHERE org_id=:o)",
        "DELETE FROM candidate_skills WHERE candidate_id IN (SELECT id FROM candidates WHERE org_id=:o)",
        "DELETE FROM candidates WHERE org_id=:o",
        "DELETE FROM job_descriptions WHERE org_id=:o",
    ]
    for s in stmts:
        try:
            await db.execute(text(s), {"o": org_id})
        except Exception as e:  # noqa: BLE001 — skip tables that may not exist
            print(f"  (skip) {s.split(' ')[2]}: {e}")


async def main():
    base = settings.FRONTEND_URL.rstrip("/")
    async with AsyncSessionLocal() as db:
        # Org
        org = (await db.execute(select(Organization).where(Organization.slug == DEMO_SLUG))).scalar_one_or_none()
        if not org:
            org = Organization(id=str(uuid.uuid4()), name=DEMO_ORG_NAME, slug=DEMO_SLUG)
            db.add(org); await db.flush()

        # Demo user (org_admin)
        user = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalar_one_or_none()
        if not user:
            user = User(id=str(uuid.uuid4()), org_id=org.id, name="Demo Recruiter", email=DEMO_EMAIL,
                        password_hash=hash_password(DEMO_PASSWORD), role=UserRole.ORG_ADMIN, is_active=True)
            db.add(user); await db.flush()
        else:
            user.password_hash = hash_password(DEMO_PASSWORD); user.org_id = org.id

        # Assign Pro plan if it exists
        pro = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.slug == "pro"))).scalar_one_or_none()
        if pro:
            sub = (await db.execute(select(Subscription).where(Subscription.org_id == org.id))).scalar_one_or_none()
            if not sub:
                db.add(Subscription(org_id=org.id, plan_id=pro.id, status=SubscriptionStatus.ACTIVE,
                                    current_period_start=now, current_period_end=now + timedelta(days=30), provider="demo"))

        # Reset prior demo data
        await reset_demo(db, org.id)
        await db.flush()

        # Jobs
        for title, skills in JOBS:
            db.add(JobDescription(id=str(uuid.uuid4()), org_id=org.id, created_by=user.id, title=title,
                                  parsed_jd={"skills": skills, "responsibilities": [f"Own {title} initiatives"]}, is_active=True))

        # Candidates (+ interviews)
        for i, (name, email, role, years, loc, rating, tech, fw, iv) in enumerate(CANDIDATES):
            cid = str(uuid.uuid4())
            db.add(Candidate(
                id=cid, org_id=org.id, created_by=user.id, name=name, email=email,
                phone=f"+9198{i}0000{i}{i}", location=loc, applied_role=role,
                total_experience_years=years, summary=f"{role} with {years} years of experience.",
                overall_rating=rating, screening_status="completed" if iv else "link_sent",
                parsed_profile=profile(name, email, f"+9198{i}0000{i}{i}", loc, years, role, tech, fw,
                                       f"{role} with {years} years of hands-on experience."),
                created_at=now - timedelta(days=12 - i * 2),
            ))
            for s in tech[:4]:
                db.add(CandidateSkill(id=str(uuid.uuid4()), candidate_id=cid, skill=s))

            token = uuid.uuid4().hex
            if iv:  # completed interview with full evaluation
                sid = str(uuid.uuid4())
                start = now - timedelta(days=10 - i, hours=2)
                db.add(InterviewSession(
                    id=sid, candidate_id=cid, org_id=org.id, created_by=user.id,
                    scheduled_at=start, duration_minutes=45, link_token=token,
                    interview_link=f"{base}/interview/{token}",
                    interview_type=iv["type"], difficulty=iv["diff"], ai_personality="Neutral",
                    status=InterviewStatus.COMPLETED, started_at=start, ended_at=start + timedelta(minutes=38),
                    actual_duration_minutes=38, evaluation_status="complete",
                    overall_rating=iv["rating"], ai_summary=iv["summary"],
                    executive_summary="\n".join(f"- {b}" for b in (iv["strengths"] + iv["weak"])),
                    strengths=iv["strengths"], weak_areas=iv["weak"],
                    topics_covered=iv["covered"], topics_missing=iv["missing"], topics_needs_evaluation=[],
                    communication_score=iv["comm"], confidence_score=iv["conf"], clarity_score=iv["clar"],
                    focus_skills=tech[:4],
                ))
                for skname, srating, sscore in iv["skills"]:
                    db.add(SkillEvaluation(id=str(uuid.uuid4()), session_id=sid, skill=skname,
                                           rating=srating, score=sscore, questions_asked=3,
                                           ai_notes=f"Assessed {skname.lower()} across multiple questions."))
            else:  # upcoming scheduled interview
                db.add(InterviewSession(
                    id=str(uuid.uuid4()), candidate_id=cid, org_id=org.id, created_by=user.id,
                    scheduled_at=now + timedelta(days=2 + i), duration_minutes=45, link_token=token,
                    interview_link=f"{base}/interview/{token}",
                    interview_type="Technical", difficulty="Medium", ai_personality="Friendly",
                    status=InterviewStatus.SCHEDULED, focus_skills=tech[:4],
                ))

        await db.commit()
        print("Demo seeded.")
        print(f"  Org:   {DEMO_ORG_NAME} (slug={DEMO_SLUG})")
        print(f"  Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"  Data:  {len(JOBS)} jobs, {len(CANDIDATES)} candidates, interviews seeded")


if __name__ == "__main__":
    asyncio.run(main())
