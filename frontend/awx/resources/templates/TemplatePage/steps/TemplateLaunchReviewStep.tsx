import { Label, LabelGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageDetail, PageDetails, useGetPageUrl } from '../../../../../../framework';
import { PageDetailCodeEditor } from '../../../../../../framework/PageDetails/PageDetailCodeEditor';
import { usePageWizard } from '../../../../../../framework/PageWizard/PageWizardProvider';
import { useGet, useGetItem } from '../../../../../common/crud/useGet';
import { CredentialLabel } from '../../../../common/CredentialLabel';
import { awxAPI } from '../../../../common/api/awx-utils';
import { useVerbosityString } from '../../../../common/useVerbosityString';
import type { Credential } from '../../../../interfaces/Credential';
import type { JobTemplate } from '../../../../interfaces/JobTemplate';
import { AwxRoute } from '../../../../main/AwxRoutes';
import type { TemplateLaunch } from '../TemplateLaunchWizard';
import { jsonToYaml, yamlToJson } from '../../../../../../framework/utils/codeEditorUtils';
import { WorkflowJobTemplate } from '../../../../interfaces/WorkflowJobTemplate';
import { Survey } from '../../../../interfaces/Survey';
import { ExecutionEnvironment } from '../../../../interfaces/ExecutionEnvironment';

function getSurveySpecUrl(template: JobTemplate | WorkflowJobTemplate) {
  if (!template) return '';
  switch (template?.type) {
    case 'job_template':
      return awxAPI`/job_templates/${template?.id.toString()}/survey_spec/`;
    case 'workflow_job_template':
      return awxAPI`/workflow_job_templates/${template?.id.toString()}/survey_spec/`;
    default:
      return '';
  }
}

function maskPasswords(vars: { [key: string]: string | string[] }, passwordKeys: string[]) {
  const updated = { ...vars };
  passwordKeys.forEach((key) => {
    if (typeof updated[key] !== 'undefined') {
      updated[key] = '$encrypted$';
    }
  });
  return updated;
}

function processSurvey(
  extra_vars: string | null,
  survey: { [key: string]: string | string[] },
  surveyConfig: Survey | null
): string {
  const extraVarsObj = extra_vars ? (JSON.parse(yamlToJson(extra_vars)) as object) : {};
  const updatedSurvey: { [key: string]: string | string[] } = { ...survey };

  if (surveyConfig?.spec) {
    const passwordFields = surveyConfig.spec
      .filter((q) => q.type === 'password')
      .map((q) => q.variable);

    const maskedSurveyPasswords = maskPasswords(survey, passwordFields);
    Object.keys(maskedSurveyPasswords).forEach((passwordKey) => {
      updatedSurvey[passwordKey] = maskedSurveyPasswords[passwordKey];
    });
  }

  const mergedData: { [key: string]: string | string[] | { name: string }[] } = {
    ...extraVarsObj,
    ...updatedSurvey,
  };

  return jsonToYaml(JSON.stringify(mergedData));
}

export function TemplateLaunchReviewStep(props: { template: JobTemplate }) {
  const { template } = props;
  const { t } = useTranslation();
  const { wizardData } = usePageWizard();
  const getPageUrl = useGetPageUrl();
  const {
    inventory,
    credentials,
    instance_groups,
    execution_environment,
    diff_mode,
    scm_branch,
    extra_vars,
    forks,
    job_slice_count,
    job_tags,
    job_type,
    labels,
    limit,
    skip_tags,
    timeout,
    verbosity,
    survey,
  } = wizardData as TemplateLaunch;
  const { data: surveyConfig } = useGet<Survey>(getSurveySpecUrl(template));

  const { data: ee } = useGetItem<ExecutionEnvironment>(
    awxAPI`/execution_environments/`,
    execution_environment
  );

  let extraVarDetails = extra_vars || '{}';
  if (survey) {
    extraVarDetails = processSurvey(extra_vars, survey, surveyConfig ?? null);
  }

  <PageDetailCodeEditor label={t('Extra vars')} value={extraVarDetails} />;

  const verbosityString = useVerbosityString(verbosity);

  const inventoryUrlPaths: { [key: string]: string } = {
    '': 'inventory',
    smart: 'smart_inventory',
    constructed: 'constructed_inventory',
  };

  return (
    <PageDetails numberOfColumns="multiple">
      <PageDetail label={t('Name')}>{template.name}</PageDetail>
      <PageDetail label={t('Job type')}>{job_type}</PageDetail>
      <PageDetail label={t('Organization')} isEmpty={!template.summary_fields.organization}>
        <Link
          to={getPageUrl(AwxRoute.OrganizationDetails, {
            params: { id: template.summary_fields?.organization?.id },
          })}
        >
          {template.summary_fields?.organization?.name}
        </Link>
      </PageDetail>
      <PageDetail label={t`Inventory`} isEmpty={!inventory?.id}>
        <Link
          to={getPageUrl(AwxRoute.InventoryDetails, {
            params: { id: inventory?.id, inventory_type: inventoryUrlPaths[inventory?.kind] },
          })}
        >
          {inventory?.name}
        </Link>
      </PageDetail>
      {template.type === 'job_template' && (
        <PageDetail label={t`Project`} isEmpty={!template.summary_fields.project}>
          <Link
            to={getPageUrl(AwxRoute.ProjectDetails, {
              params: { id: template.summary_fields?.project?.id },
            })}
          >
            {template.summary_fields.project?.name}
          </Link>
        </PageDetail>
      )}
      <PageDetail label={t`Execution environment`} isEmpty={isEmpty(execution_environment)}>
        <Link
          to={getPageUrl(AwxRoute.ExecutionEnvironmentDetails, {
            params: execution_environment ? { id: execution_environment } : {},
          })}
        >
          {ee?.name}
        </Link>
      </PageDetail>
      <PageDetail label={t('Source control branch')}>{scm_branch}</PageDetail>
      {template.type === 'job_template' && (
        <PageDetail label={t('Playbook')}>{template?.playbook}</PageDetail>
      )}
      <PageDetail label={t('Credentials')} isEmpty={isEmpty(credentials)}>
        <LabelGroup>
          {credentials?.map((credential) => (
            <CredentialDetail credentialID={credential.id} key={credential.id} />
          ))}
        </LabelGroup>
      </PageDetail>
      <PageDetail
        label={t`Instance groups`}
        helpText={t`The instance groups for this job template to run on.`}
        isEmpty={isEmpty(instance_groups)}
      >
        <LabelGroup>
          {instance_groups?.map((ig) => (
            <Label color="blue" key={ig.id}>
              <Link
                to={getPageUrl(AwxRoute.InstanceGroupDetails, {
                  params: {
                    id: ig.id,
                  },
                })}
              >
                {ig.name}
              </Link>
            </Label>
          ))}
        </LabelGroup>
      </PageDetail>
      <PageDetail label={t('Forks')}>{forks || 0}</PageDetail>
      <PageDetail label={t('Limit')}>{limit}</PageDetail>
      <PageDetail label={t('Verbosity')}>{verbosityString}</PageDetail>
      <PageDetail label={t('Timeout')}>{timeout || 0}</PageDetail>
      <PageDetail label={t('Show changes')}>{diff_mode ? t`On` : t`Off`}</PageDetail>
      <PageDetail label={t('Job slicing')}>{job_slice_count}</PageDetail>
      <PageDetail label={t('Labels')} isEmpty={isEmpty(labels)}>
        <LabelGroup>
          {labels?.map((label) => <Label key={label.id}>{label.name}</Label>)}
        </LabelGroup>
      </PageDetail>
      <PageDetail label={t('Job tags')} isEmpty={isEmpty(job_tags)}>
        <LabelGroup>{job_tags?.map(({ name }) => <Label key={name}>{name}</Label>)}</LabelGroup>
      </PageDetail>
      <PageDetail label={t('Skip tags')} isEmpty={isEmpty(skip_tags)}>
        <LabelGroup>{skip_tags?.map(({ name }) => <Label key={name}>{name}</Label>)}</LabelGroup>
      </PageDetail>
      <PageDetailCodeEditor label={t('Extra vars')} value={extraVarDetails} />
    </PageDetails>
  );
}

export function CredentialDetail({ credentialID }: { credentialID: number }) {
  const { data: credentialData } = useGet<Credential>(
    awxAPI`/credentials/${credentialID.toString()}/`
  );
  if (!credentialData) return null;
  return <CredentialLabel credential={credentialData} key={credentialID} />;
}

function isEmpty(value: undefined | null | object[] | object | number): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0 || Object.values(value).every(isEmpty);
  }
  return false;
}
