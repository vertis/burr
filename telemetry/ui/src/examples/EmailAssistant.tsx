import { ComputerDesktopIcon, UserIcon } from '@heroicons/react/24/outline';
import { classNames } from '../utils/tailwind';
import { TwoColumnLayout } from '../components/common/layout';
import { MiniTelemetry } from './MiniTelemetry';
import {
  ApplicationSummary,
  DefaultService,
  DraftInit,
  EmailAssistantState,
  Feedbacks,
  QuestionAnswers
} from '../api';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { Loading } from '../components/common/loading';
import { Field, Label } from '../components/common/fieldset';
import { Textarea } from '../components/common/textarea';
import { Input } from '../components/common/input';
import { Text } from '../components/common/text';
import { Button } from '../components/common/button';
import { DateTimeDisplay } from '../components/common/dates';
import AsyncCreatableSelect from 'react-select/async-creatable';

type Role = 'assistant' | 'user';

const getCharacter = (role: Role) => {
  return role === 'assistant' ? 'AI' : 'You';
};

const RoleIcon = (props: { role: Role }) => {
  const Icon = props.role === 'assistant' ? ComputerDesktopIcon : UserIcon;
  return (
    <Icon className={classNames('text-gray-400', 'ml-auto h-6 w-6 shrink-0')} aria-hidden="true" />
  );
};

const LAST_MESSAGE_ID = 'last-message';

const ImageWithBackup = (props: { src: string; alt: string }) => {
  const [caption, setCaption] = useState<string | undefined>(undefined);
  return (
    <div>
      <img
        src={props.src}
        alt={props.alt}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.src = 'https://via.placeholder.com/500x500?text=Image+Unavailable';
          img.alt =
            'Image unavailable as OpenAI does not persist images -- generate a new one, or modify the code to save it for you.';
          setCaption(img.alt);
        }}
      />
      {caption && <span className="italic text-gray-300">{caption}</span>}
    </div>
  );
};

const scrollToLatest = () => {
  const lastMessage = document.getElementById(LAST_MESSAGE_ID);
  if (lastMessage) {
    const scroll = () => {
      lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    };
    scroll();
    const observer = new ResizeObserver(() => {
      scroll();
    });
    observer.observe(lastMessage);
    setTimeout(() => observer.disconnect(), 1000); // Adjust timeout as needed
  }
};

export const CurrentStateView = (props: { state: EmailAssistantState }) => {
  const components = [];
  if (props.state.email_to_respond !== null) {
    components.push(
      <Field>
        <Label>Input Email</Label>
        <Text>
          <pre className="whitespace-pre-wrap text-xs">{props.state.email_to_respond}</pre>
        </Text>
      </Field>
    );
    components.push(
      <Field>
        <Label>Response Instructions</Label>
        <Text>{props.state.response_instructions}</Text>
      </Field>
    );
  }
  return <div className="flex flex-col gap-2">{components}</div>;
};

export const SubmitInitialView = (props: {
  submitInitial: (initial: DraftInit) => void;
  isLoading: boolean;
}) => {
  const [userProvidedEmailToRespond, setUserProvidedEmailToRespond] = useState<string>('');
  const [userProvidedResponseInstructions, setUserProvidedResponseInstructions] =
    useState<string>('');
  return (
    <div className="w-full flex flex-col gap-2">
      <Field>
        <Label>Email to respond to</Label>
        <Textarea
          name="email_to_respond"
          value={userProvidedEmailToRespond}
          onChange={(e) => {
            setUserProvidedEmailToRespond(e.target.value);
          }}
        />
      </Field>
      <Field>
        <Label>Response Instructions</Label>
        <Input
          name="response_instructions"
          value={userProvidedResponseInstructions}
          onChange={(e) => {
            setUserProvidedResponseInstructions(e.target.value);
          }}
        />
      </Field>
      <Button
        color="white"
        className="cursor-pointer w-full"
        onClick={() =>
          props.submitInitial({
            email_to_respond: userProvidedEmailToRespond,
            response_instructions: userProvidedResponseInstructions
          })
        }>
        {'Submit'}
      </Button>
    </div>
  );
};

export const SubmitAnswersView = (props: {
  state: EmailAssistantState;
  submitAnswers: (questions: QuestionAnswers) => void;
}) => {
  const questions = props.state.questions || [];
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''));
  return (
    <div className="w-full flex flex-col gap-2">
      <h2 className="text-lg font-bold text-gray-600">Clarifications</h2>
      <div className="flex flex-col gap-2">
        {(props.state.questions || []).map((question, index) => {
          return (
            <Field key={index}>
              <Label>{question}</Label>
              <Input
                value={answers[index]}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[index] = e.target.value;
                  setAnswers(newAnswers);
                }}
              />
            </Field>
          );
        })}
      </div>
      <Button
        color="white"
        className="cursor-pointer w-full"
        onClick={() => props.submitAnswers({ answers: answers })}>
        {'Submit'}
      </Button>
    </div>
  );
};

export const SubmitFeedbackView = (props: {
  state: EmailAssistantState;
  submitFeedback: (feedbacks: Feedbacks) => void;
}) => {
  return <></>;
};

export const EmailAssistant = (props: { projectId: string; appId: string | undefined }) => {
  // starts off as null
  const [emailAssistantState, setEmailAssistantState] = useState<EmailAssistantState | null>(null);
  console.log(emailAssistantState);
  const [userProvidedEmailToRespond, setUserProvidedEmailToRespond] = useState<string>('');
  const [userProvidedResponseInstructions, setUserProvidedResponseInstructions] =
    useState<string>('');

  useEffect(() => {
    if (props.appId !== undefined) {
      // TODO -- handle errors
      DefaultService.getStateApiV0EmailAssistantProjectIdAppIdStateGet(props.projectId, props.appId)
        .then((data) => {
          setEmailAssistantState(data); // we want to initialize the chat history
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }, [props.appId, props.projectId]); // This will only get called when the appID or projectID changes, which will be at the beginning

  const { isLoading: isGetInitialStateLoading } = useQuery(
    // TODO -- handle errors
    ['emailAssistant', props.projectId, props.appId],
    () =>
      DefaultService.getStateApiV0EmailAssistantProjectIdAppIdStateGet(
        props.projectId,
        props.appId || '' // TODO -- find a cleaner way of doing a skip-token like thing here
        // This is skipped if the appId is undefined so this is just to make the type-checker happy
      ),
    {
      enabled: props.appId !== undefined,
      onSuccess: (data) => {
        setEmailAssistantState(data); // when its succesful we want to set the displayed chat history
      }
    }
  );

  const submitInitialMutation = useMutation(
    (draftData: DraftInit) =>
      DefaultService.initializeDraftApiV0EmailAssistantProjectIdAppIdInitializeDraftPost(
        props.projectId,
        props.appId || 'create_new',
        draftData
      ),
    {
      onSuccess: (data) => {
        setEmailAssistantState(data);
      }
    }
  );

  const submitAnswersMutation = useMutation(
    (answers: QuestionAnswers) =>
      DefaultService.answerQuestionsApiV0EmailAssistantProjectIdAppIdAnswerQuestionsPost(
        props.projectId,
        props.appId || '',
        answers
      ),
    {
      onSuccess: (data) => {
        setEmailAssistantState(data);
      }
    }
  );
  const submitFeedbackMutation = useMutation(
    (feedbacks: Feedbacks) =>
      DefaultService.provideFeedbackApiV0EmailAssistantProjectIdAppIdProvideFeedbackPost(
        props.projectId,
        props.appId || '',
        feedbacks
      ),
    {
      onSuccess: (data) => {
        setEmailAssistantState(data);
      }
    }
  );

  //   // Scroll to the latest message when the chat history changes
  //   useEffect(() => {
  //     scrollToLatest();
  //   }, [emailAssistantState]);

  //   const mutation = useMutation(
  //     (message: string) => {
  //       return DefaultService.chatResponseApiV0ChatbotProjectIdAppIdResponsePost(
  //         props.projectId,
  //         props.appId || '',
  //         message
  //       );
  //     },
  //     {
  //       onSuccess: (data) => {
  //         setDisplayedChatHistory(data);
  //       }
  //     }
  //   );
  const isLoading = isGetInitialStateLoading;
  const anyMutationLoading =
    submitInitialMutation.isLoading ||
    submitAnswersMutation.isLoading ||
    submitFeedbackMutation.isLoading;

  if (isLoading) {
    return <Loading />;
  }
  return (
    <div className="px-4 bg-white  w-full flex flex-col  h-full gap-5 overflow-y-scroll">
      <h1 className="text-2xl font-bold  text-gray-600">{'Learn Burr '}</h1>
      <h2 className="text-lg font-normal text-gray-500 flex flex-row">
        The email assistant below is implemented using Burr. Copy/paste the email you want to
        respond to and provide directions, it will ask you questions, generate a response, and
        adjust for your feedback.
      </h2>
      <div className="flex flex-col">
        {emailAssistantState === null ? (
          <p className="text-lg font-normal text-gray-500">
            Please click "create new" on the right to get started!
          </p> // TODO -- figure out what goes here?
        ) : emailAssistantState.next_step === 'process_input' ? (
          <SubmitInitialView
            submitInitial={(draft) => submitInitialMutation.mutate(draft)}
            isLoading={anyMutationLoading}
          />
        ) : emailAssistantState.next_step === 'clarify_instructions' ? (
          <>
            <CurrentStateView state={emailAssistantState} />
            <SubmitAnswersView
              state={emailAssistantState}
              submitAnswers={(feedbacks) => submitAnswersMutation.mutate(feedbacks)}
            />
          </>
        ) : emailAssistantState.next_step === 'process_feedback' ? (
          <>
            <CurrentStateView state={emailAssistantState} />
            <SubmitFeedbackView
              state={emailAssistantState}
              submitFeedback={(feedbacks) => submitFeedbackMutation.mutate(feedbacks)}
            />
          </>
        ) : (
          <SubmitFeedbackView
            state={emailAssistantState}
            submitFeedback={(feedbacks) => submitFeedbackMutation.mutate(feedbacks)}
          />
        )}
      </div>
    </div>
  );
};

export const TelemetryWithSelector = (props: {
  projectId: string;
  currentApp: ApplicationSummary | undefined;
  setCurrentApp: (app: ApplicationSummary) => void;
}) => {
  return (
    <div className="w-full h-[90%]">
      <div className="w-full">
        <EmailAssistantAppSelector
          projectId={props.projectId}
          setApp={props.setCurrentApp}
          currentApp={props.currentApp}
          placeholder={
            'Select a conversation or create a new one by typing...'
          }></EmailAssistantAppSelector>
      </div>
      <MiniTelemetry projectId={props.projectId} appId={props.currentApp?.app_id}></MiniTelemetry>
    </div>
  );
};

const EmailAssistantLabel = (props: { application: ApplicationSummary }) => {
  return (
    <div className="flex flex-row gap-2 items-center justify-between">
      <div className="flex flex-row gap-2 items-center">
        <span className="text-gray-400 w-10">{props.application.num_steps}</span>
        <span>{props.application.app_id}</span>
      </div>
      <DateTimeDisplay date={props.application.first_written} mode="short" />
    </div>
  );
};

export const EmailAssistantAppSelector = (props: {
  projectId: string;
  setApp: (app: ApplicationSummary) => void;
  currentApp: ApplicationSummary | undefined;
  placeholder: string;
}) => {
  const { projectId, setApp } = props;
  const { data, refetch } = useQuery(
    ['apps', projectId],
    () => DefaultService.getAppsApiV0ProjectIdAppsGet(projectId as string),
    { enabled: projectId !== undefined }
  );
  const createAndUpdateMutation = useMutation(
    (app_id: string) =>
      DefaultService.createNewApplicationApiV0EmailAssistantProjectIdAppIdCreatePost(
        projectId,
        app_id
      ),
    {
      onSuccess: (appID) => {
        refetch().then((data) => {
          const appSummaries = data.data || [];
          const app = appSummaries.find((app) => app.app_id === appID);
          if (app) {
            setApp(app);
          }
        });
      }
    }
  );
  const appSetter = (appID: string) => createAndUpdateMutation.mutate(appID);
  const dataOrEmpty = Array.from(data || []);
  const options = dataOrEmpty
    .sort((a, b) => {
      return new Date(a.last_written) > new Date(b.last_written) ? -1 : 1;
    })
    .map((app) => {
      return {
        value: app.app_id,
        label: <EmailAssistantLabel application={app} />
      };
    });
  return (
    <AsyncCreatableSelect
      placeholder={props.placeholder}
      cacheOptions
      defaultOptions={options}
      onCreateOption={appSetter}
      value={options.find((option) => option.value === props.currentApp?.app_id) || null}
      onChange={(choice) => {
        const app = dataOrEmpty.find((app) => app.app_id === choice?.value);
        if (app) {
          setApp(app);
        }
      }}
    />
  );
};

export const EmailAssistantWithTelemetry = () => {
  const currentProject = 'demo:email-assistant';
  const [currentApp, setCurrentApp] = useState<ApplicationSummary | undefined>(undefined);

  return (
    <TwoColumnLayout
      firstItem={<EmailAssistant projectId={currentProject} appId={currentApp?.app_id} />}
      secondItem={
        <TelemetryWithSelector
          projectId={currentProject}
          currentApp={currentApp}
          setCurrentApp={setCurrentApp}
        />
      }
      mode={'third'}></TwoColumnLayout>
  );
};
