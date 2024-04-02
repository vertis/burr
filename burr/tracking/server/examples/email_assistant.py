import functools
import importlib
from typing import Any, Dict, List, Literal, Optional

import pydantic
from fastapi import FastAPI

from burr.core import Application

email_assistant_application = importlib.import_module(
    "burr.examples.email-assistant.application"
)  # noqa: F401


# we want to render this after every response
class EmailAssistantState(pydantic.BaseModel):
    app_id: str
    email_to_respond: Optional[str]
    response_instructions: Optional[str]
    questions: Optional[List[str]]
    answers: Optional[List[str]]
    drafts: List[str]
    feedbacks: List[str]
    final_draft: Optional[str]
    # This stores the next step, which tells the frontend which ones to call
    next_step: Literal["process_input", "clarify_instructions", "process_feedback", None]

    @staticmethod
    def from_app(app: Application):
        state = app.state
        next_action = app.get_next_action().name
        # TODO -- consolidate with the above
        if next_action not in ("clarify_instructions", "process_feedback", "process_input"):
            # quick hack -- this just means we're done if its an error
            # TODO -- add recovery
            next_action = None
        return EmailAssistantState(
            app_id=app.uid,
            email_to_respond=state.get("incoming_email"),
            response_instructions=state.get("response_instructions"),
            questions=state.get("clarification_questions"),
            answers=state.get("clarification_answers"),
            drafts=state.get("draft_history", []),
            feedbacks=state.get("feedback", []),
            final_draft=state.get("final_draft"),
            next_step=next_action,
        )


@functools.lru_cache(maxsize=128)
def _get_application(project_id: str, app_id: str) -> Application:
    app = email_assistant_application.application(app_id=app_id, project=project_id)
    return app


def _run_through(project_id: str, app_id: [str], inputs: Dict[str, Any]) -> EmailAssistantState:
    if app_id == "create_new":  # quick hack to allow for null
        app_id = None
    email_assistant_app = _get_application(project_id, app_id)
    email_assistant_app.run(  # Using this as a side-effect, we'll just get the state aft
        halt_before=["clarify_instructions", "process_feedback"],
        halt_after=["final_result"],
        inputs=inputs,
    )
    return EmailAssistantState.from_app(email_assistant_app)


class DraftInit(pydantic.BaseModel):
    email_to_respond: str
    response_instructions: str


def create_new_application(project_id: str, app_id: str) -> str:
    app = _get_application(project_id, app_id)
    return app.uid


def initialize_draft(project_id: str, app_id: str, draft_data: DraftInit) -> EmailAssistantState:
    return _run_through(
        project_id,
        app_id,
        dict(
            email_to_respond=draft_data.email_to_respond,
            response_instructions=draft_data.response_instructions,
        ),
    )


class QuestionAnswers(pydantic.BaseModel):
    answers: List[str]


def answer_questions(
    project_id: str, app_id: str, question_answers: QuestionAnswers
) -> EmailAssistantState:
    return _run_through(project_id, app_id, dict(answers=question_answers.answers))


class Feedbacks(pydantic.BaseModel):
    feedbacks: List[str]


def provide_feedback(project_id: str, app_id: str, feedbacks: Feedbacks) -> EmailAssistantState:
    return _run_through(project_id, app_id, dict(feedbacks=feedbacks))


def get_state(project_id: str, app_id: str) -> EmailAssistantState:
    email_assistant_app = _get_application(project_id, app_id)
    return EmailAssistantState.from_app(email_assistant_app)


def register(app: FastAPI, api_prefix: str):
    app.post(
        f"{api_prefix}/{{project_id}}/{{app_id}}/initialize_draft",
        response_model=EmailAssistantState,
    )(initialize_draft)
    app.post(
        f"{api_prefix}/{{project_id}}/{{app_id}}/answer_questions",
        response_model=EmailAssistantState,
    )(answer_questions)
    app.post(
        f"{api_prefix}/{{project_id}}/{{app_id}}/provide_feedback",
        response_model=EmailAssistantState,
    )(provide_feedback)
    app.get(f"{api_prefix}/{{project_id}}/{{app_id}}/state", response_model=EmailAssistantState)(
        get_state
    )
    app.post(f"{api_prefix}/{{project_id}}/{{app_id}}/create")(create_new_application)
